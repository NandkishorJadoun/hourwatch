import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { AppHeader } from '#/components/app-header'
import { getSession } from '#/lib/auth.functions'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const session = await getSession()

    if (!session) {
      throw redirect({ to: '/' })
    }

    return { user: session.user }
  },
  component: () => {
    const { user } = Route.useRouteContext()

    return (
      <div className="min-h-screen">
        <AppHeader user={user} />
        <Outlet />
      </div>
    )
  },
})