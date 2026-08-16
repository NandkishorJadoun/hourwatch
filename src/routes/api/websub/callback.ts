import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'

import { db } from '#/lib/db'
import { channels, trackedVideos, websubSubscriptions } from '#/db/schema'
import { sendToChannel } from '#/lib/push'
import { captureSnapshotForVideo } from '#/lib/snapshots'

const TRACKING_WINDOW_MS = 6 * 60 * 60 * 1000

export const Route = createFileRoute('/api/websub/callback')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const mode = url.searchParams.get('hub.mode')
        const topic = url.searchParams.get('hub.topic')
        const challenge = url.searchParams.get('hub.challenge')
        const leaseSeconds = url.searchParams.get('hub.lease_seconds')

        if (mode === 'denied') {
          console.error('WebSub subscription denied for topic', topic)
          return new Response('subscription denied', { status: 404 })
        }

        if (mode === 'subscribe' && topic && challenge) {
          const subscription = await db
            .select()
            .from(websubSubscriptions)
            .where(eq(websubSubscriptions.hubTopic, topic))
            .limit(1)

          if (subscription[0]) {
            const leaseMs = leaseSeconds ? Number(leaseSeconds) * 1000 : undefined

            await db
              .update(websubSubscriptions)
              .set({
                verifiedAt: new Date(),
                leaseExpiresAt: leaseMs ? new Date(Date.now() + leaseMs) : undefined,
              })
              .where(eq(websubSubscriptions.id, subscription[0].id))

            return new Response(challenge)
          }
        }

        return new Response('Not found', { status: 404 })
      },
      POST: async ({ request }: { request: Request }) => {
        const body = await request.text()

        await handleDelivery(body)

        return new Response('ok', { status: 200 })
      },
    },
  },
})

async function handleDelivery(atomXml: string) {
  for (const entry of extractEntries(atomXml)) {
    if (!entry.videoId || !entry.channelId) continue

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.youtubeChannelId, entry.channelId))
      .limit(1)

    if (!channel[0]) continue

    const publishedAt = new Date(entry.published ?? Date.now())

    const videoId = crypto.randomUUID()

    const result = await db
      .insert(trackedVideos)
      .values({
        id: videoId,
        channelId: channel[0].id,
        youtubeVideoId: entry.videoId,
        publishedAt,
        trackingEndsAt: new Date(publishedAt.getTime() + TRACKING_WINDOW_MS),
      })
      .onConflictDoNothing({ target: trackedVideos.youtubeVideoId })
      .run()

    const changes = result.meta.changes ?? 0
    if (changes > 0) {
      await captureSnapshotForVideo({
        id: videoId,
        channelId: channel[0].id,
        userId: channel[0].userId,
        youtubeVideoId: entry.videoId,
        publishedAt,
      })

      try {
        await sendToChannel(channel[0].id, {
          title: 'New video live',
          body: `"${entry.title}" is public. We'll check in hourly. Sit back.`,
          url: '/dashboard',
        })
      } catch (err) {
        console.error('Failed to send upload notification:', err)
      }
    }
  }
}

function extractEntries(
  xml: string,
): Array<{ videoId?: string; channelId?: string; published?: string; title?: string }> {
  const entries: Array<{
    videoId?: string
    channelId?: string
    published?: string
    title?: string
  }> = []
  const entryRe = /<entry[\s\S]*?<\/entry>/g
  const videoIdRe = /<yt:videoId>([^<]+)<\/yt:videoId>/
  const channelIdRe = /<yt:channelId>([^<]+)<\/yt:channelId>/
  const publishedRe = /<published>([^<]+)<\/published>/
  const titleRe = /<title>([^<]+)<\/title>/

  let match: RegExpExecArray | null
  while ((match = entryRe.exec(xml)) !== null) {
    const chunk = match[0]
    entries.push({
      videoId: chunk.match(videoIdRe)?.[1],
      channelId: chunk.match(channelIdRe)?.[1],
      published: chunk.match(publishedRe)?.[1],
      title: chunk.match(titleRe)?.[1],
    })
  }

  return entries
}