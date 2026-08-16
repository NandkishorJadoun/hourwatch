# hourwatch

**Publish your videos. Step away. We monitor the first six hours for you.**

hourwatch is a PWA for YouTube creators that watches a newly published video for its first six
hours and pushes mobile notifications when something worth knowing happens — view counts, and how
the upload is pacing against the channel's own average. The pitch: *upload, put your phone away,
and stop refreshing YouTube Studio every minute.*

## Features

- **Instant upload detection** via WebSub/PubSubHubbub — no polling. The moment a video goes public,
  a webhook tells us and a 6-hour tracking window starts.
- **Hourly view snapshots** pulled from the YouTube Data API (`videos.list` statistics — near
  real-time, not the 48h-delayed Analytics API).
- **Baseline pacing** — once a channel has ~3 prior tracked videos, notifications compare the new
  upload's views against the channel's own average at the same hour.
- **Web Push notifications** — "New video live" when a video goes public, then a check-in every hour
  with the current number, plus a final summary when the window closes.
- **PWA** — installable, offline-capable shell, dark-by-default with a light/dark toggle.
- **Dashboard** — connect your channel, manage notifications, and review every tracked video and its
  hourly snapshot history (history stays visible after the window closes).

## How it works

1. You connect your YouTube channel via Google OAuth (offline access, so we hold a refresh token).
2. We subscribe the channel's upload feed to YouTube's WebSub hub.
3. You publish a video normally. YouTube's hub POSTs to our webhook within seconds → we insert a
   tracked video and grab the first view count immediately.
4. An hourly Cloudflare Cron Trigger checks every video still inside its window, stores a snapshot,
   and pushes a notification to your phone.
5. The dashboard lists tracked videos and their hourly history, during and after the 6-hour window.

## Tech stack

- **Framework:** TanStack Start (React 19, SSR)
- **Host:** Cloudflare Workers — server routes, cron, and the webhook receiver all live in one Worker
- **Database:** Cloudflare D1 + Drizzle ORM
- **Auth:** Better Auth (Google social provider, `accessType: "offline"`)
- **Upload detection:** WebSub/PubSubHubbub (lease auto-renews via a daily cron)
- **View data:** YouTube Data API v3 `videos.list`
- **Notifications:** Web Push API (VAPID), no Firebase
- **UI:** Tailwind CSS v4, lucide-react

## Getting started

### Prerequisites

- Node.js 20+ and pnpm
- A Cloudflare account (for the deployed D1 + Worker)
- A Google Cloud project with the YouTube Data API v3 enabled

### Environment variables

Copy `.dev.vars.example` to `.dev.vars` and fill in values for local development. For production,
set non-secret vars in `wrangler.jsonc` under `vars` and secret vars with `wrangler secret put`:

| Variable | Description |
| --- | --- |
| `BETTER_AUTH_URL` | The app's public base URL (used for OAuth callback + webhook) |
| `BETTER_AUTH_SECRET` | Secret used to sign sessions |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `VAPID_SUBJECT` | `mailto:` (or URL) contact required by the Web Push spec |

Register the OAuth redirect URI in Google Console:
`{BETTER_AUTH_URL}/api/auth/callback/google`

### Install and run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The dev server proxies the Worker (Cloudflare Vite plugin), so D1,
cron, and WebSub bindings behave as they do in production.

### Database

Create the D1 database and apply migrations (the repo's `database_name` in `wrangler.jsonc` is
`first6-db`; create it with that name and paste the printed `database_id` in):

```bash
wrangler d1 create first6-db   # prints a database_id
# paste the id into wrangler.jsonc under d1_databases
pnpm drizzle:migrate              # applies migrations to local dev
pnpm drizzle:migrate --remote     # applies migrations to production
```

After changing `src/db/schema.ts`, regenerate migrations with `pnpm drizzle:generate`.

### Deploy

```bash
pnpm deploy
```

The Worker runs two Cron Triggers (defined in `wrangler.jsonc`):

- **Hourly** (`0 * * * *`): snapshot every video still inside its 6-hour window.
- **Daily** (`0 5 * * *`): renew WebSub subscriptions expiring within ~24h, so a channel never
  silently stops getting notified.

## API quota notes

The YouTube Data API default quota is 10,000 units/day. `videos.list` costs 1 unit per call, so
hourly checks across dozens of in-window videos are well under the ceiling. The Analytics API is
not used in v1 (its ~48h delay blocks CTR-based rescue logic; view tracking is near-real-time).

## Roadmap

- Configurable tracking window (beyond the fixed 6 hours) via user settings
- Retention-drop-off flagging via Analytics API `audienceWatchRatio`
- Tag/title-to-CTR correlation across a channel's history

## License

MIT
