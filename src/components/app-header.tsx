import { Link } from '@tanstack/react-router'
import { Download, LogOut, Moon, Sun } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { useTheme } from '#/lib/theme'
import { usePwaInstall } from '#/lib/use-pwa-install'

type AppUser = {
  name: string
  email: string
}

export function AppHeader({ user }: { user?: AppUser | null }) {
  const { theme, toggleTheme } = useTheme()
  const { canInstall, install } = usePwaInstall()

  const onSignOut = async () => {
    await authClient.signOut()
    window.location.href = '/'
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-chrome">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link to="/dashboard" className="flex items-center">
          <img src="/logo-192.png" alt="hourwatch" className="h-9 w-auto" />
        </Link>

        <div className="flex items-center gap-1">
          {canInstall && (
            <button
              type="button"
              onClick={() => void install()}
              aria-label="Install hourwatch as an app"
              title="Install app"
              className="btn-icon"
            >
              <Download className="size-5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="btn-icon"
          >
            {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>

          {user && (
            <>
              <div className="mx-1 hidden items-center gap-2 sm:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-medium text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-40 truncate text-sm text-ink">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="btn-icon"
              >
                <LogOut className="size-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}