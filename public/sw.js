/* Never cache API responses or personal viewing data on disk. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
 let data = {}; try { data = event.data?.json() || {}; } catch { /* Show safe fallback. */ }
 event.waitUntil(self.registration.showNotification(data.title || 'Viewing reminder', {
  body: data.body || 'Open Viewing Tracker to check your next viewing.',
  icon: '/icon-192.png', badge: '/badge-96.png', tag: data.tag || 'viewing-reminder',
  requireInteraction: true, renotify: true, vibrate: [400, 150, 400, 150, 700],
  data: { url: data.url || '/', maps: data.maps },
  actions: [{ action: 'open', title: 'View details' }, ...(data.maps ? [{ action: 'maps', title: 'Google Maps' }] : [])]
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const data = event.notification.data || {};
 let url = new URL(data.url || '/', self.location.origin);
 if (url.origin !== self.location.origin) url = new URL('/', self.location.origin);
 if (event.action === 'maps' && data.maps) {
  const maps = new URL(data.maps);
  if (maps.origin === 'https://www.google.com') url = maps;
 }
 event.waitUntil(self.clients.openWindow(url.href));
});
