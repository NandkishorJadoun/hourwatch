# AGENTS.md

> Working name: **hourwatch** (swap in one line if you land on something else; nothing else in this doc depends on the name).

## What this app is

A PWA that watches a creator's freshly published YouTube video for its first six hours and pushes a mobile notification when something worth knowing happens, so the creator doesn't have to sit there refreshing analytics.

Pitch: *publish it, put your phone away, we'll tell you what matters.*

## Core user flow (this is the whole v1 loop; every piece below is required for the pitch to be true)

1. Creator connects their YouTube channel via Google OAuth.
2. App subscribes to a **WebSub (PubSubHubbub)** feed for that channel's uploads.
3. Creator publishes a video normally on YouTube.
4. YouTube's hub POSTs to our webhook the moment the video goes public → we insert a `tracked_videos` row and start its 6-hour window.
5. An hourly Cloudflare Cron Trigger checks every video still inside its window: pulls current view count, compares to the channel's own baseline (if enough history exists), stores a snapshot.
6. A Web Push notification goes to the creator's device with the number and, once baseline exists, how this upload is pacing against their own average.
7. The PWA dashboard lists tracked videos and their hourly snapshot history, during and after the 6-hour window.

## Tech stack

- **Framework:** TanStack Start
- **Host/runtime:** Cloudflare Workers (entire app: server routes, cron, webhook receiver, all of it)
- **Database:** Cloudflare D1
- **ORM:** Drizzle
- **Auth:** Better Auth (Google social provider, `accessType: "offline"` so a refresh token is always issued)
- **Notifications:** Web Push API (VAPID), not Firebase Cloud Messaging
- **Upload detection:** WebSub/PubSubHubbub subscription to YouTube's hub: **not polling**
- **View data:** YouTube Data API v3 `videos.list` (`statistics.viewCount`), near-real-time (minutes-to-hours lag). **Not** the Analytics API, which has a ~48h data delay.

## Rejected approaches (do not reintroduce these)

- **CTR/impressions-based rescue system.** Blocked by the YouTube Analytics API's ~48-hour data delay on `videoThumbnailImpressionsClickRate`. Confirmed via research before pivoting; this is why the app tracks views, not CTR.
- **Polling for new uploads.** Replaced by the WebSub webhook for near-instant detection instead of up-to-an-hour-late polling.
- **Prisma.** Drizzle is the native, first-class fit for D1 + Workers.
- **Client-side scheduling (`setInterval` in the PWA, background sync for hourly checks).** Service workers do not reliably run for 6 hours in the background, especially on iOS. All scheduling lives server-side via Cron Triggers. The PWA client only displays state; it never schedules anything.

## Data model (Drizzle + D1)

Better Auth owns the core auth tables (`user`, `session`, `account`, `verification`) and stores the Google OAuth tokens (`access_token`, `refresh_token`, `accessTokenExpiresAt`, `scope`) on its `account` table; don't duplicate tokens on `channels`. Pull them via Better Auth's access-token handling.

- **channels**: `id`, `user_id` (FK → Better Auth `user`), `youtube_channel_id`, `created_at`
- **websub_subscriptions**: `channel_id`, `hub_topic`, `lease_expires_at`, `verified_at`
- **tracked_videos**: `id`, `channel_id`, `youtube_video_id`, `published_at`, `tracking_ends_at`
- **video_snapshots**: `id`, `tracked_video_id`, `hour_offset`, `view_count`, `checked_at`
- **push_subscriptions**: `id`, `channel_id`, `endpoint`, `p256dh`, `auth`

Snapshot history stays visible in the dashboard after the 6-hour window closes; don't delete it.

## Edge cases the code must handle

1. **No baseline yet** (fewer than ~3 prior tracked videos for the channel): notification copy is a raw number only, no pace comparison. Switch to baseline-relative copy automatically once enough history exists.
2. **WebSub lease expiry** (~5 days): a renewal cron re-subscribes before the lease lapses. Don't let this fail silently: a channel that stops getting notified a week in is a trust-breaking bug, not an edge case to skip.
3. **WebSub verification handshake:** the hub sends a challenge on subscribe; it must be echoed back correctly or the subscription silently fails.
4. **Delayed webhook delivery:** if the webhook fires late and part of the 6-hour window has already elapsed, skip the missed hours gracefully and start snapshotting from the current elapsed hour; don't crash, don't backfill fake data.
5. **Concurrent videos:** the hourly cron must handle every video currently inside its window in one run, not just the most recent one.

## Explicitly out of scope for the hackathon build (v2+)

- Retention drop-off timestamp flagging via Analytics API `audienceWatchRatio` (reuses the same cron; natural next feature)
- Tag/title-to-CTR correlation analysis across a channel's history
- Reach prediction before publishing
- Configurable tracking window (24h, etc.) beyond the fixed 6 hours
- Any automated thumbnail/title swapping

## API quota notes

- Data API default quota: 10,000 units/day. `videos.list` costs 1 unit per call; hourly checks across dozens of in-window videos is cheap and won't come close to the ceiling.
- Analytics API is not used in v1 at all.

## Conventions

- TypeScript strict mode throughout.
- Server logic (cron handlers, webhook receiver, OAuth callback) lives in TanStack Start server routes / Workers handlers, not in client code.
- Secrets via Wrangler secrets (`wrangler secret put`), never committed to the repo.
- Auth routes: mount Better Auth at a `$/` catch-all route (e.g. `/api/auth/$`); add the `tanstackStartCookies()` plugin, last.
- Use Better Auth's access-token handling (`getAccessToken`) to obtain a valid, auto-refreshed access token for YouTube Data API calls; don't hand-roll token refresh.
- D1 doesn't support interactive transactions: use `db.batch()`, not `db.transaction()` (Better Auth's adapter throws on it).

## Environment variables / secrets

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (Better Auth callback `{BETTER_AUTH_URL}/api/auth/callback/google`; must be registered exactly in Google Console)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (mailto: contact address required by the Web Push spec)

## Deployment

- Entire app (TanStack Start server + PWA) deploys to Cloudflare Workers.
- D1 database bound via `wrangler.toml`.
- Two Cron Triggers defined in `wrangler.toml`: hourly snapshot check, and a WebSub lease-renewal check (run daily, renew anything expiring within ~24h).