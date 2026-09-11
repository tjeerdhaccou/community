/* buuur service worker — bewust minimaal: alleen Web Push en klik-afhandeling.
   Géén asset-caching, zodat een nieuwe deploy nooit oude bundles blijft serveren. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data?.text() } }
  const title = data.title || 'Nieuw bericht'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'buuur-chat',
    renotify: true,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Hergebruik een open tab van dezelfde origin als die er is.
    const target = new URL(url, self.location.origin)
    for (const c of all) {
      try {
        if (new URL(c.url).origin === target.origin) {
          await c.focus()
          if ('navigate' in c) await c.navigate(target.href)
          return
        }
      } catch { /* volgende */ }
    }
    await self.clients.openWindow(target.href)
  })())
})
