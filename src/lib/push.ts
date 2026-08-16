import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

import { db } from '#/lib/db'
import { pushSubscriptions } from '#/db/schema'

webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
)

export interface PushPayload {
  title: string
  body: string
  url: string
}

export async function sendToChannel(channelId: string, payload: PushPayload) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.channelId, channelId))

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      )
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id))
          .run()
      } else if (status === 429) {
        console.warn(`Push rate limited for subscription ${sub.id}`)
      } else {
        console.error(`Push send failed for subscription ${sub.id}:`, err)
      }
    }
  }
}