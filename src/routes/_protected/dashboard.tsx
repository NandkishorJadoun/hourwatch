import { createFileRoute, Link } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/_protected/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useRouteContext()
  const { data: session } = authClient.useSession()

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {user.name}!</p>
      <p>
        Channel connection and video tracking arrive next. Your account row is
        ready: <code>{session?.user.id}</code>
      </p>
      <Link to="/">Home</Link>
    </main>
  )
}