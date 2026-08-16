import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { connectChannel, getChannelConnection } from '#/lib/channel.functions'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/_protected/dashboard')({
  loader: async () => {
    const connection = await getChannelConnection()
    return { connection }
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { connection } = Route.useLoaderData()
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
        </div>
      ) : (
        <div>
          <button type="button" onClick={onConnect} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect YouTube channel'}
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}

      <p>
        <Link to="/">Home</Link>
      </p>
    </main>
  )
}