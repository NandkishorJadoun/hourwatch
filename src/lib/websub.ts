import { eq } from 'drizzle-orm'

import { db } from '#/lib/db'
import { websubSubscriptions } from '#/db/schema'

export const YOUTUBE_HUB = 'https://pubsubhubbub.appspot.com/subscribe'
export const YOUTUBE_LEASE_SECONDS = 432000

export const youtubeTopic = (channelId: string) =>
  `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`

export async function subscribeToChannel(
  youtubeChannelId: string,
  channelId: string,
  callbackUrl: string,
): Promise<{ id: string; hubTopic: string }> {
  const hubTopic = youtubeTopic(youtubeChannelId)

  const existing = await db
    .select()
    .from(websubSubscriptions)
    .where(eq(websubSubscriptions.hubTopic, hubTopic))
    .limit(1)

  if (existing[0]) {
    return { id: existing[0].id, hubTopic }
  }

  const body = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.topic': hubTopic,
    'hub.callback': callbackUrl,
    'hub.lease_seconds': String(YOUTUBE_LEASE_SECONDS),
  })

  const res = await fetch(YOUTUBE_HUB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (res.status >= 400) {
    throw new Error(`WebSub subscribe failed: ${res.status} ${await res.text()}`)
  }

  const id = crypto.randomUUID()

  await db.insert(websubSubscriptions).values({
    id,
    channelId,
    hubTopic,
  })

  return { id, hubTopic }
}