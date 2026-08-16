import { eq, gt } from 'drizzle-orm'

import { auth } from '#/lib/auth'
import { db } from '#/lib/db'
import { channels, trackedVideos, videoSnapshots } from '#/db/schema'

const HOUR_MS = 60 * 60 * 1000
const INSERT_CHUNK = 20

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

      const inserts: (typeof videoSnapshots.$inferInsert)[] = []

      for (const row of userRows) {
        const viewCount = viewCounts.get(row.youtubeVideoId)
        if (viewCount === undefined) continue

        const hourOffset = Math.floor((now - row.publishedAt.getTime()) / HOUR_MS)
        if (hourOffset < 0) continue

        inserts.push({
          id: crypto.randomUUID(),
          trackedVideoId: row.videoId,
          hourOffset,
          viewCount,
          checkedAt: new Date(now),
        })
      }

      if (inserts.length > 0) {
        const chunks: (typeof videoSnapshots.$inferInsert)[][] = []
        for (let i = 0; i < inserts.length; i += INSERT_CHUNK) {
          chunks.push(inserts.slice(i, i + INSERT_CHUNK))
        }

        for (const chunk of chunks) {
          await db.insert(videoSnapshots).values(chunk).onConflictDoNothing()
        }
      }
    } catch (err) {
      console.error(`Snapshot run failed for user ${userId}:`, err)
    }
  }
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
