import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { connectChannel, getChannelConnection, getTrackedVideos } from '#/lib/channel.functions'
import {
  deletePushSubscription,
  getVapidPublicKey,
  savePushSubscription,
} from '#/lib/push.functions'
import { disableNotifications, enableNotifications, getExistingSubscription } from '#/lib/push.web'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/_protected/dashboard')({
  loader: async () => {
    const [connection, videos] = await Promise.all([getChannelConnection(), getTrackedVideos()])
    return { connection, videos }
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { connection, videos } = Route.useLoaderData()
  const { data: session } = authClient.useSession()

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
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>
        Signed in as <code>{session?.user.email}</code>
      </p>

      {activeConnection ? (
        <div>
          <p>Channel connected: <code>{activeConnection.youtubeChannelId}</code></p>
          <p>
            Subscription: {activeConnection.verified ? 'verified' : 'awaiting hub verification'}
          </p>
          {activeConnection.leaseExpiresAt && (
            <p>Lease expires: {new Date(activeConnection.leaseExpiresAt).toLocaleString()}</p>
          )}
          {!activeConnection.verified && (
            <button type="button" onClick={onConnect} disabled={connecting}>
              {connecting ? 'Re-subscribing…' : 'Re-subscribe to channel'}
            </button>
          )}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      ) : (
        <div>
          <button type="button" onClick={onConnect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect YouTube channel'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}

      {activeConnection && <NotificationsSection />}

      <h2>Tracked videos</h2>
      {videos.length === 0 ? (
        <p>No tracked videos yet. Publish a public video and it will show up here.</p>
      ) : (
        <ul>
          {videos.map((video) => {
            const published = new Date(video.publishedAt)
            const ends = new Date(video.trackingEndsAt)
            const hoursLeft = Math.max(
              0,
              Math.ceil((ends.getTime() - Date.now()) / (60 * 60 * 1000)),
            )
            return (
              <li key={video.id}>
                <a
                  href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {video.youtubeVideoId}
                </a>{' '}
                — published {published.toLocaleString()} ·{' '}
                {video.latestViewCount !== null
                  ? `${video.latestViewCount.toLocaleString()} views at hour ${video.latestHourOffset} · `
                  : ''}
                {hoursLeft > 0 ? `${hoursLeft}h left in window` : 'window closed'}
              </li>
            )
          })}
        </ul>
      )}

      <p>
        <Link to="/">Home</Link>
      </p>
    </main>
  )
}

function NotificationsSection() {
  const [status, setStatus] = useState<'checking' | 'on' | 'off' | 'unsupported'>('checking')
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
    setError(null)
    try {
      const publicKey = await getVapidPublicKey()
      await enableNotifications(publicKey, (sub) => savePushSubscription({ data: sub }))
      setStatus('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications')
    }
  }

  const onDisable = async () => {
    setError(null)
    try {
      const existing = await getExistingSubscription()
      await disableNotifications(existing, ({ endpoint }) =>
        deletePushSubscription({ data: { endpoint } }),
      )
      setStatus('off')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications')
    }
  }

  if (status === 'unsupported') {
    return (
      <div>
        <h2>Notifications</h2>
        <p>Web Push is not supported in this browser.</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Notifications</h2>
      {status === 'checking' && <p>Checking…</p>}
      {status === 'on' && (
        <div>
          <p>Notifications enabled — you'll hear when a video is published and hourly while it's tracked.</p>
          <button type="button" onClick={onDisable}>
            Disable notifications
          </button>
        </div>
      )}
      {status === 'off' && (
        <div>
          <button type="button" onClick={onEnable}>
            Enable notifications
          </button>
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}