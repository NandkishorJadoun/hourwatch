import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, Play, PlayCircle, Plug } from 'lucide-react'

import { AppHeader } from '#/components/app-header'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: Home })

const STEPS = [
  {
    icon: Plug,
    title: 'Connect your channel',
    description: 'Sign in with Google and link your YouTube channel. That’s it.',
  },
  {
    icon: Play,
    title: 'Publish on YouTube',
    description: 'Upload a public video like you always do. We detect it the moment it goes live.',
  },
  {
    icon: Bell,
    title: 'We watch the first six hours',
    description: 'An hourly check tracks views against your own baseline and pings your phone.',
  },
]

function Home() {
  const { data: session, isPending } = authClient.useSession()

  const signInWithGoogle = async () => {
    await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pt-16 sm:pt-24">
        <img src="/logo-512.png" alt="first6" className="mb-8 h-24 w-24" />

        <h1 className="text-center text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Publish it.
          <br />
          Put your phone away.
        </h1>

        <p className="mt-5 max-w-md text-center text-lg text-muted">
          first6 watches your freshly published video for its first six hours and tells you what
          matters — so you don’t have to keep refreshing analytics.
        </p>

        <div className="mt-10 w-full max-w-sm">
          {isPending ? (
            <p className="text-center text-sm text-muted">Loading…</p>
          ) : session ? (
            <Link to="/dashboard" className="btn-primary w-full">
              Go to dashboard
            </Link>
          ) : (
            <button type="button" onClick={signInWithGoogle} className="btn-primary w-full">
              <PlayCircle className="size-5" />
              Sign in with Google
            </button>
          )}
        </div>

        <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="card p-5">
              <step.icon className="mb-3 size-5 text-link" />
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Step {i + 1}</p>
              <h2 className="mt-1 text-sm font-semibold text-ink">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-muted">
        first6 — no F5, no refresh, no refresh anxiety.
      </footer>
    </div>
  )
}