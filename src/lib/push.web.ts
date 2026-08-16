function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i)
  }
  return bytes
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function enableNotifications(
  publicKey: string,
  saveFn: (sub: { endpoint: string; p256dh: string; auth: string }) => Promise<unknown>,
): Promise<void> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission denied')
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  await saveFn({
    endpoint: subscription.endpoint,
    p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')!),
    auth: arrayBufferToBase64Url(subscription.getKey('auth')!),
  })
}

export async function disableNotifications(
  existing: PushSubscription | null,
  deleteFn: (args: { endpoint: string }) => Promise<unknown>,
): Promise<void> {
  if (existing) {
    await existing.unsubscribe()
    await deleteFn({ endpoint: existing.endpoint })
  }
}