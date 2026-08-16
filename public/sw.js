self.addEventListener('push', (event) => {
  let data = { title: 'first6', body: '', url: '/' }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    // ignore malformed payloads
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      tag: 'first6',
      icon: '/logo-192.png',
      badge: '/logo-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})