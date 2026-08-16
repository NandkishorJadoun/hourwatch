import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { connectChannel, getChannelConnection, getTrackedVideos } from '#/lib/channel.functions'
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