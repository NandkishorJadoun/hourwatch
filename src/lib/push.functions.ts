import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

import { auth } from '#/lib/auth'
import { db } from '#/lib/db'
import { channels, pushSubscriptions } from '#/db/schema'

export const getVapidPublicKey = createServerFn({ method: 'GET' }).handler(() => {
  return env.VAPID_PUBLIC_KEY
})

export const savePushSubscription = createServerFn({ method: 'POST' })
  .validator(
    (input: { endpoint: string; p256dh: string; auth: string }) => input,
  )
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session) {
      throw new Error('Unauthorized')
    }

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.userId, session.user.id))
      .limit(1)

    if (!channel[0]) {
      throw new Error('Connect your YouTube channel first')
    }

    await db
      .insert(pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        channelId: channel[0].id,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { channelId: channel[0].id, p256dh: data.p256dh, auth: data.auth },
      })
      .run()

    return { ok: true }
  })

export const deletePushSubscription = createServerFn({ method: 'POST' })
  .validator((input: { endpoint: string }) => input)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders()
    const session = await auth.api.getSession({ headers })

    if (!session) {
      throw new Error('Unauthorized')
    }

    const channel = await db
      .select()
      .from(channels)
      .where(eq(channels.userId, session.user.id))
      .limit(1)

    if (channel[0]) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(eq(pushSubscriptions.endpoint, data.endpoint), eq(pushSubscriptions.channelId, channel[0].id)),
        )
        .run()
    }

    return { ok: true }
  })