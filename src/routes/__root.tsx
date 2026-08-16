import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ThemeProvider, themeInitScript } from '../lib/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#0f0f0f',
      },
      {
        name: 'color-scheme',
        content: 'dark light',
      },
      {
        title: 'first6 — your first six hours, watched',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/logo-192.png',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo-192.png',
      },
    ],
    scripts: [
      {
        children: themeInitScript,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration is best-effort
      })
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}