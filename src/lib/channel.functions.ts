import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

import { auth } from '#/lib/auth'
import { db } from '#/lib/db'
import { channels, trackedVideos, videoSnapshots, websubSubscriptions } from '#/db/schema'
import { fetchMyChannel } from '#/lib/youtube'
import { subscribeToChannel } from '#/lib/websub'

export const connectChannel = createServerFn({ method: 'POST' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })

  if (!session) {
    throw new Error('Unauthorized')
  }

  const { accessToken } = await auth.api.getAccessToken({
    body: { providerId: 'google' },
    headers,
  })

  if (!accessToken) {
    throw new Error('No Google access token found for this account')
  }

  const channel = await fetchMyChannel(accessToken)

  if (!channel) {
    throw new Error('No YouTube channel is associated with this Google account')
  }

  const existing = await db
    .select()
    .from(channels)
    .where(eq(channels.youtubeChannelId, channel.id))
    .limit(1)

  let channelRow = existing[0]

  if (!channelRow) {
    const id = crypto.randomUUID()
    const createdAt = new Date()

    await db.insert(channels).values({
      id,
      userId: session.user.id,
      youtubeChannelId: channel.id,
      createdAt,
    })

    channelRow = { id, userId: session.user.id, youtubeChannelId: channel.id, createdAt }
  }

  const subscription = await subscribeToChannel(
    channelRow.youtubeChannelId,
    channelRow.id,
    `${env.BETTER_AUTH_URL}/api/websub/callback`,
  )

  return { channel: { id: channel.id, title: channel.title }, subscription }
})

export const getTrackedVideos = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })

  if (!session) {
    return []
  }

  const videos = await db
    .select({
      id: trackedVideos.id,
      youtubeVideoId: trackedVideos.youtubeVideoId,
      publishedAt: trackedVideos.publishedAt,
      trackingEndsAt: trackedVideos.trackingEndsAt,
    })
    .from(trackedVideos)
    .innerJoin(channels, eq(trackedVideos.channelId, channels.id))
    .where(eq(channels.userId, session.user.id))
    .orderBy(desc(trackedVideos.publishedAt))

  if (videos.length === 0) {
    return []
  }

  const snapshots = await db
    .select({
      trackedVideoId: videoSnapshots.trackedVideoId,
      hourOffset: videoSnapshots.hourOffset,
      viewCount: videoSnapshots.viewCount,
    })
    .from(videoSnapshots)
    .where(inArray(videoSnapshots.trackedVideoId, videos.map((v) => v.id)))

  const latestByVideo = new Map<string, { hourOffset: number; viewCount: number }>()
  for (const snapshot of snapshots) {
    const current = latestByVideo.get(snapshot.trackedVideoId)
    if (!current || snapshot.hourOffset > current.hourOffset) {
      latestByVideo.set(snapshot.trackedVideoId, {
        hourOffset: snapshot.hourOffset,
        viewCount: snapshot.viewCount,
      })
    }
  }

  return videos.map((video) => ({
    ...video,
    latestViewCount: latestByVideo.get(video.id)?.viewCount ?? null,
    latestHourOffset: latestByVideo.get(video.id)?.hourOffset ?? null,
  }))
})

export const getChannelConnection = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders()
  const session = await auth.api.getSession({ headers })

  if (!session) {
    return null
  }

  const rows = await db
    .select({
      channel: channels,
      subscription: websubSubscriptions,
    })
    .from(channels)
    .leftJoin(websubSubscriptions, eq(websubSubscriptions.channelId, channels.id))
    .where(eq(channels.userId, session.user.id))

  return rows.map((row) => ({
    id: row.channel.id,
    youtubeChannelId: row.channel.youtubeChannelId,
    verified: Boolean(row.subscription?.verifiedAt),
    leaseExpiresAt: row.subscription?.leaseExpiresAt ?? null,
  }))
})