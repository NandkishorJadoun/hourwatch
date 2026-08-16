import { createFileRoute, Link } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data: session, isPending } = authClient.useSession()

  const signInWithGoogle = async () => {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' })
  }

  return (
    <main>
      <h1>first6</h1>
      <p>Publish it. Put your phone away. We'll tell you what matters.</p>

      {isPending ? (
        <p>Loading…</p>
      ) : session ? (
        <div>
          <p>Signed in as {session.user.name}</p>
          <Link to="/dashboard">Go to dashboard</Link>
        </div>
      ) : (
        <button type="button" onClick={signInWithGoogle}>
          Sign in with Google
        </button>
      )}
    </main>
  )
}