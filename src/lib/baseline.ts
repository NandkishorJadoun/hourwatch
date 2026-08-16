import { and, eq, inArray, lt } from 'drizzle-orm'

import { db } from '#/lib/db'
import { trackedVideos, videoSnapshots } from '#/db/schema'

export async function getBaseline(
  channelId: string,
  currentPublishedAt: Date,
  hourOffset: number,
): Promise<number | null> {
  const priorVideos = await db
    .select({ id: trackedVideos.id })
    .from(trackedVideos)
    .where(
      and(
        eq(trackedVideos.channelId, channelId),
        lt(trackedVideos.publishedAt, currentPublishedAt),
      ),
    )

  if (priorVideos.length < 3) return null

  const snapshots = await db
    .select({
      trackedVideoId: videoSnapshots.trackedVideoId,
      viewCount: videoSnapshots.viewCount,
    })
    .from(videoSnapshots)
    .where(
      and(
        inArray(
          videoSnapshots.trackedVideoId,
          priorVideos.map((video) => video.id),
        ),
        eq(videoSnapshots.hourOffset, hourOffset),
      ),
    )

  const videosWithSnapshot = new Set(snapshots.map((snapshot) => snapshot.trackedVideoId))
  if (videosWithSnapshot.size < 3) return null

  const sum = snapshots.reduce((total, snapshot) => total + snapshot.viewCount, 0)
  return sum / snapshots.length
}