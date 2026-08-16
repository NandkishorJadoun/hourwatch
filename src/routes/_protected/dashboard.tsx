import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Eye,
  Link2,
  Loader2,
  Play,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { connectChannel, getChannelConnection, getTrackedVideos } from '#/lib/channel.functions'
import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
} from '#/lib/push.functions'
import { disableNotifications, enableNotifications, getExistingSubscription } from '#/lib/push.web'

export const Route = createFileRoute('/_protected/dashboard')({
  loader: async () => {
    const [connection, videos] = await Promise.all([getChannelConnection(), getTrackedVideos()])
    return { connection, videos }
  },
  component: Dashboard,
})

type Video = {
  id: string
  youtubeVideoId: string
  publishedAt: Date
  trackingEndsAt: Date
  latestViewCount: number | null
  latestHourOffset: number | null
}

const TRACKING_WINDOW_HOURS = 6

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { connection, videos } = Route.useLoaderData()

  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      await connectChannel()
      await router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect channel')
    } finally {
      setConnecting(false)
    }
  }

  const activeConnection = connection?.[0] ?? null

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Channel</h1>
          <p className="text-sm text-muted">
            {user.name} · {user.email}
          </p>
        </div>
        <div className="sm:text-right">
          <Link to="/" className="text-sm text-link hover:underline">
            Home
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChannelCard
          connected={Boolean(activeConnection)}
          verified={activeConnection?.verified ?? false}
          leaseExpiresAt={activeConnection?.leaseExpiresAt ?? null}
          onConnect={onConnect}
          connecting={connecting}
          error={error}
        />
        {activeConnection && <NotificationsSection />}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-ink">Tracked videos</h2>
        {videos.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Play className="size-8 text-muted" />
            <p className="max-w-sm text-sm text-muted">
              No tracked videos yet. Publish a public video and it will show up here the moment it
              goes live.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {videos.map((video) => (
              <li key={video.id}>
                <VideoCard video={video} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function ChannelCard({
  connected,
  verified,
  leaseExpiresAt,
  onConnect,
  connecting,
  error,
}: {
  connected: boolean
  verified: boolean
  leaseExpiresAt: Date | null
  onConnect: () => void
  connecting: boolean
  error: string | null
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Link2 className="size-4 text-muted" />
          YouTube channel
        </h2>
        {connected && (
          <span className="chip">
            {verified ? (
              <>
                <CheckCircle2 className="size-3.5 text-success" />
                Verified
              </>
            ) : (
              <>
                <AlertTriangle className="size-3.5 text-warning" />
                Awaiting hub verification
              </>
            )}
          </span>
        )}
      </div>

      {connected ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-muted">
            Your uploads are being watched. New public videos start hourly tracking the moment they
            go live, with a 6-hour window by default.
          </p>
          {leaseExpiresAt && (
            <p className="text-muted">
              WebSub subscription renews on{' '}
              <span className="text-ink">{new Date(leaseExpiresAt).toLocaleString()}</span>
            </p>
          )}
          <p className="text-xs text-muted">
            6-hour window by default. Customizable tracking window coming in an update.
          </p>
          {!verified && (
            <button type="button" onClick={onConnect} disabled={connecting} className="btn-secondary">
              {connecting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Re-subscribing…
                </>
              ) : (
                'Re-subscribe to channel'
              )}
            </button>
          )}
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            Connect your YouTube channel so hourwatch can check your uploads every hour after every
            publish.
          </p>
          <button type="button" onClick={onConnect} disabled={connecting} className="btn-primary">
            {connecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connecting…
              </>
            ) : (
              'Connect YouTube channel'
            )}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
        </div>
      )}
    </div>
  )
}

function NotificationsSection() {
  const [status, setStatus] = useState<'checking' | 'on' | 'off' | 'unsupported'>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      const existing = await getExistingSubscription()
      if (!cancelled) setStatus(existing ? 'on' : 'off')
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const onEnable = async () => {
    setBusy(true)
    setError(null)
    try {
      const publicKey = await getVapidPublicKey()
      await enableNotifications(publicKey, (sub) => savePushSubscription({ data: sub }))
      setStatus('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications')
    } finally {
      setBusy(false)
    }
  }

  const onDisable = async () => {
    setBusy(true)
    setError(null)
    try {
      const existing = await getExistingSubscription()
      await disableNotifications(existing, ({ endpoint }) =>
        deletePushSubscription({ data: { endpoint } }),
      )
      setStatus('off')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          {status === 'on' ? (
            <Bell className="size-4 text-muted" />
          ) : (
            <BellOff className="size-4 text-muted" />
          )}
          Notifications
        </h2>
        {status === 'on' && (
          <span className="chip">
            <Bell className="size-3.5 text-success" />
            On
          </span>
        )}
      </div>

      {status === 'checking' && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Checking…
        </p>
      )}

      {status === 'unsupported' && (
        <p className="mt-4 text-sm text-muted">Web Push is not supported in this browser.</p>
      )}

      {status === 'on' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            You’ll be pinged the moment a new video goes live and hourly while it’s inside its
            6-hour window.
          </p>
          <button
            type="button"
            onClick={onDisable}
            disabled={busy}
            className="btn-secondary"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Disable notifications'}
          </button>
        </div>
      )}

      {status === 'off' && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            Get a push when your uploads go live and while they’re tracked.
          </p>
          <button type="button" onClick={onEnable} disabled={busy} className="btn-primary">
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Enable notifications'}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </div>
  )
}

function VideoCard({ video }: { video: Video }) {
  const published = new Date(video.publishedAt)
  const ends = new Date(video.trackingEndsAt)
  const now = Date.now()
  const hoursLeft = Math.max(0, Math.ceil((ends.getTime() - now) / (60 * 60 * 1000)))
  const windowClosed = now >= ends.getTime()
  const elapsed = Math.min(
    TRACKING_WINDOW_HOURS,
    Math.max(0, (now - published.getTime()) / (60 * 60 * 1000)),
  )
  const percent = Math.round((elapsed / TRACKING_WINDOW_HOURS) * 100)

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex gap-4">
        <VideoThumb videoId={video.youtubeVideoId} />
        <div className="min-w-0 flex-1">
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium text-ink hover:text-link"
          >
            {video.youtubeVideoId}
          </a>
          <p className="mt-1 text-sm text-muted">
            Published {published.toLocaleString()}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            {video.latestViewCount !== null ? (
              <>
                <Eye className="size-3.5" />
                {video.latestViewCount.toLocaleString()} views at hour {video.latestHourOffset}
              </>
            ) : (
              'Waiting for first snapshot…'
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          {windowClosed ? (
            <span className="font-medium text-ink">Window closed</span>
          ) : (
            <span className="font-medium text-ink">
              {hoursLeft}h left in window
            </span>
          )}
          <span>6h tracking</span>
        </div>
        <div className="progress-track mt-1.5">
          <div
            className={windowClosed ? 'h-full rounded-full bg-line' : 'progress-fill'}
            style={{ width: `${windowClosed ? 100 : percent}%` }}
          />
        </div>
      </div>
    </article>
  )
}

function VideoThumb({ videoId }: { videoId: string }) {
  const [broken, setBroken] = useState(false)

  if (broken) {
    return (
      <div className="flex aspect-video w-32 shrink-0 items-center justify-center rounded-md bg-surface-hover sm:w-40">
        <Play className="size-6 text-muted" />
      </div>
    )
  }

  return (
    <img
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt={`Thumbnail for ${videoId}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="aspect-video w-32 shrink-0 rounded-md object-cover sm:w-40"
    />
  )
}