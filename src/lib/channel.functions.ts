import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'

import { auth } from '#/lib/auth'
import { db } from '#/lib/db'
import { channels, websubSubscriptions } from '#/db/schema'
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
    channel.id,
    `${env.BETTER_AUTH_URL}/api/websub/callback`,
  )

  return { channel: { id: channel.id, title: channel.title }, subscription }
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