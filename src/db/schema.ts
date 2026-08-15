import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
})

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('session_token_idx').on(table.token),
    index('session_userId_idx').on(table.userId),
  ],
)

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    index('account_userId_idx').on(table.userId),
    index('account_accountId_idx').on(table.accountId),
  ],
)

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    youtubeChannelId: text('youtube_channel_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('channels_youtube_channel_id_unique').on(table.youtubeChannelId),
    index('channels_user_id_idx').on(table.userId),
  ],
)

export const websubSubscriptions = sqliteTable(
  'websub_subscriptions',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    hubTopic: text('hub_topic').notNull(),
    leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp_ms' }),
    verifiedAt: integer('verified_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('websub_subscriptions_hub_topic_unique').on(table.hubTopic),
    index('websub_subscriptions_channel_id_idx').on(table.channelId),
  ],
)

export const trackedVideos = sqliteTable(
  'tracked_videos',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    youtubeVideoId: text('youtube_video_id').notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }).notNull(),
    trackingEndsAt: integer('tracking_ends_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('tracked_videos_youtube_video_id_unique').on(table.youtubeVideoId),
    index('tracked_videos_channel_id_idx').on(table.channelId),
  ],
)

export const videoSnapshots = sqliteTable(
  'video_snapshots',
  {
    id: text('id').primaryKey(),
    trackedVideoId: text('tracked_video_id')
      .notNull()
      .references(() => trackedVideos.id, { onDelete: 'cascade' }),
    hourOffset: integer('hour_offset').notNull(),
    viewCount: integer('view_count').notNull(),
    checkedAt: integer('checked_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('video_snapshots_tracked_video_hour_unique').on(
      table.trackedVideoId,
      table.hourOffset,
    ),
    index('video_snapshots_hour_offset_idx').on(table.hourOffset),
  ],
)

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_unique').on(table.endpoint),
    index('push_subscriptions_channel_id_idx').on(table.channelId),
  ],
)