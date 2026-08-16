import { eq, gt } from 'drizzle-orm'

import { auth } from '#/lib/auth'
import { db } from '#/lib/db'
import { channels, trackedVideos, videoSnapshots } from '#/db/schema'
import { getBaseline } from '#/lib/baseline'
import { sendToChannel } from '#/lib/push'

const HOUR_MS = 60 * 60 * 1000

export interface TrackedVideoInput {
  id: string
  channelId: string
  userId: string
  youtubeVideoId: string
  publishedAt: Date
}

export async function captureSnapshotForVideo(video: TrackedVideoInput) {
  const { accessToken } = await auth.api.getAccessToken({
    body: { providerId: 'google', userId: video.userId },
  })

  if (!accessToken) {
    console.error(`First snapshot: no access token for user ${video.userId}`)
    return
  }

  const viewCounts = await fetchViewCounts(accessToken, [video.youtubeVideoId])
  const viewCount = viewCounts.get(video.youtubeVideoId)
  if (viewCount === undefined) return

  const hourOffset = Math.max(0, Math.floor((Date.now() - video.publishedAt.getTime()) / HOUR_MS))

  await db
    .insert(videoSnapshots)
    .values({
      id: crypto.randomUUID(),
      trackedVideoId: video.id,
      hourOffset,
      viewCount,
      checkedAt: new Date(),
    })
    .onConflictDoNothing()
    .run()
}

export async function runHourlySnapshots() {
  const now = Date.now()

  const rows = await db
    .select({
      videoId: trackedVideos.id,
      youtubeVideoId: trackedVideos.youtubeVideoId,
      publishedAt: trackedVideos.publishedAt,
      channelId: trackedVideos.channelId,
      userId: channels.userId,
    })
    .from(trackedVideos)
    .innerJoin(channels, eq(trackedVideos.channelId, channels.id))
    .where(gt(trackedVideos.trackingEndsAt, new Date(now)))

  if (rows.length === 0) return

  const byUser = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? []
    list.push(row)
    byUser.set(row.userId, list)
  }

  for (const [userId, userRows] of byUser) {
    try {
      const { accessToken } = await auth.api.getAccessToken({
        body: { providerId: 'google', userId },
      })

      if (!accessToken) {
        console.error(`Snapshot run: no access token for user ${userId}`)
        continue
      }

      const viewCounts = await fetchViewCounts(
        accessToken,
        userRows.map((row) => row.youtubeVideoId),
      )

      for (const row of userRows) {
        const viewCount = viewCounts.get(row.youtubeVideoId)
        if (viewCount === undefined) continue

        const hourOffset = Math.floor((now - row.publishedAt.getTime()) / HOUR_MS)
        if (hourOffset < 0) continue

        const result = await db
          .insert(videoSnapshots)
          .values({
            id: crypto.randomUUID(),
            trackedVideoId: row.videoId,
            hourOffset,
            viewCount,
            checkedAt: new Date(now),
          })
          .onConflictDoNothing()
          .run()

        const inserted = result.meta.changes ?? 0
        if (inserted === 0) continue

        await notifySnapshot(row, hourOffset, viewCount)
      }
    } catch (err) {
      console.error(`Snapshot run failed for user ${userId}:`, err)
    }
  }
}

async function notifySnapshot(
  row: {
    videoId: string
    youtubeVideoId: string
    publishedAt: Date
    channelId: string
  },
  hourOffset: number,
  viewCount: number,
) {
  try {
    const baseline = await getBaseline(row.channelId, row.publishedAt, hourOffset)

    const prefix = hourOffset >= 5 ? 'Final check · ' : ''
    const body =
      baseline === null
        ? `${prefix}${viewCount.toLocaleString()} views at hour ${hourOffset}`
        : `${prefix}${withBaselineCopy(viewCount, hourOffset, baseline)}`

    await sendToChannel(row.channelId, {
      title: '6-hour check',
      body,
      url: '/dashboard',
    })
  } catch (err) {
    console.error('Failed to send snapshot notification:', err)
  }
}

function withBaselineCopy(viewCount: number, hourOffset: number, baseline: number): string {
  const pct = baseline === 0 ? 0 : Math.round(((viewCount - baseline) / baseline) * 100)
  const direction = pct >= 0 ? 'above' : 'below'
  return `${viewCount.toLocaleString()} views at hour ${hourOffset}: ${Math.abs(
    pct,
  )}% ${direction} your channel average (${Math.round(baseline)})`
}

async function fetchViewCounts(accessToken: string, videoIds: string[]) {
  const counts = new Map<string, number>()

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(
      videoIds.join(','),
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!res.ok) {
    throw new Error(`YouTube API error ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as {
    items?: Array<{ id?: string; statistics?: { viewCount?: string } }>
  }

  for (const item of data.items ?? []) {
    if (!item.id || !item.statistics?.viewCount) continue
    counts.set(item.id, Number(item.statistics.viewCount))
  }

  return counts
}