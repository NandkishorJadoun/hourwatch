import { eq, isNull, lt, or } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

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
    await postSubscribe(hubTopic, callbackUrl)
    return { id: existing[0].id, hubTopic }
  }

  await postSubscribe(hubTopic, callbackUrl)

  const id = crypto.randomUUID()

  await db.insert(websubSubscriptions).values({
    id,
    channelId,
    hubTopic,
  })

  return { id, hubTopic }
}

async function postSubscribe(hubTopic: string, callbackUrl: string) {
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
}

export async function renewExpiringSubscriptions() {
  const soon = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const rows = await db
    .select({ id: websubSubscriptions.id, hubTopic: websubSubscriptions.hubTopic })
    .from(websubSubscriptions)
    .where(
      or(
        isNull(websubSubscriptions.leaseExpiresAt),
        lt(websubSubscriptions.leaseExpiresAt, soon),
      ),
    )

  const callbackUrl = `${env.BETTER_AUTH_URL}/api/websub/callback`

  for (const row of rows) {
    try {
      await postSubscribe(row.hubTopic, callbackUrl)
    } catch (err) {
      console.error(`Failed to renew subscription ${row.id}:`, err)
    }
  }
}