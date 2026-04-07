/* ============================================
   Service Worker — Contas a Pagar
   Gerenciado pelo VitePWA/Workbox em produção.
   Este arquivo existe apenas como fallback mínimo
   para o manifest.json e instalação PWA.
   ============================================ */

// O VitePWA gera o SW real via Workbox.
// Este arquivo é um stub para não quebrar referências legadas.
// Em produção, o Workbox SW sobrescreve este registro.

const CACHE_VERSION = 'contas-v' + Date.now();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Limpa caches de versões anteriores
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
      )
    ])
  );
});

/* ---------- PUSH NOTIFICATIONS ---------- */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Contas a Pagar';
  const options = {
    body: data.body || 'Você tem contas a vencer em breve.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100, 50, 100],
    tag: data.tag || 'contas-notif',
    renotify: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver agora' },
      { action: 'close', title: 'Dispensar' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- NOTIFICATION CLICK ---------- */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* ---------- BACKGROUND SYNC ---------- */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-contas') {
    // Placeholder para sincronização offline futura
  }
});
