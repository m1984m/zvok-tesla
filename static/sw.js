// Service worker: ob namestitvi predpomni vse datoteke iz precache.json (ustvari ga build),
// nato streže iz predpomnilnika; omrežje samo za posodobitve.
const VERSION = new URL(self.location).searchParams.get('v') || 'dev'
const CACHE = `pogon-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      const list = await (await fetch('precache.json', { cache: 'no-store' })).json()
      await cache.addAll(['./', ...list])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' })
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch {
        return (req.mode === 'navigate' && (await cache.match('./'))) || Response.error()
      }
    })(),
  )
})
