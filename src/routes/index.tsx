import { createFileRoute, Link } from '@tanstack/react-router'
import { Bell, Play, PlayCircle, Plug } from 'lucide-react'

import { AppHeader } from '#/components/app-header'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: Home })

const STEPS = [
  {
    icon: Plug,
    title: 'Connect once',
    description: 'Sign in with Google and link your YouTube channel. We handle the rest.',
  },
  {
    icon: Play,
    title: 'Upload & forget',
    description: 'Publish on YouTube like you always do. Hourly monitoring starts the moment it goes public.',
  },
  {
    icon: Bell,
    title: 'We report, you relax',
    description: 'Hourly updates on your phone, paced against your channel average. Keep doing your thing.',
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
        <img src="/logo-512.png" alt="hourwatch" className="mb-8 h-24 w-24" />

        <p className="text-sm font-medium uppercase tracking-widest text-muted">
          Hourly monitoring after you publish. Alerts when something’s worth knowing
        </p>

        <h1 className="mt-4 text-center text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Publish your videos.
          <br />
          Step away.
        </h1>

        <p className="mt-5 max-w-md text-center text-lg text-muted">
          hourwatch checks your new uploads every hour and pings your phone when something’s worth
          knowing: views, pacing, anything notable. No more refreshing YouTube Studio every minute.
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

        <p className="mt-8 text-center text-xs text-muted">
          Tracks for 6 hours by default after a video goes live. Customizable window coming soon.
        </p>
      </main>

      <footer className="py-8 text-center text-xs text-muted">
        hourwatch. Upload, put your phone away. We’ll tell you what matters.
      </footer>
    </div>
  )
}