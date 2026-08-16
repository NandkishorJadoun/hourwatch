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
        name: 'description',
        content:
          'hourwatch checks your new YouTube uploads hourly and pings your phone when something is worth knowing. Publish your videos, step away. We monitor for you.',
      },
      {
        title: 'hourwatch: publish your videos, step away',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: 'hourwatch: publish your videos, step away',
      },
      {
        property: 'og:description',
        content:
          'We check your new YouTube uploads every hour and tell you what matters, so you never have to keep refreshing YouTube Studio.',
      },
      {
        property: 'og:url',
        content: 'https://hourwatch.2006.workers.dev',
      },
      {
        property: 'og:image',
        content: 'https://hourwatch.2006.workers.dev/logo-512.png',
      },
      {
        property: 'og:site_name',
        content: 'hourwatch',
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: 'hourwatch: publish your videos, step away',
      },
      {
        name: 'twitter:description',
        content:
          'We check your new YouTube uploads every hour and ping your phone when something is worth knowing.',
      },
      {
        name: 'twitter:image',
        content: 'https://hourwatch.2006.workers.dev/logo-512.png',
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