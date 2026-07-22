// Handler de push — registrado separadamente do SW do vite-plugin-pwa
self.addEventListener('push', event => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch(_) { payload = { title: 'FinanceApp', body: event.data.text() }; }

  const { title = 'FinanceApp', body = '', data = {} } = payload;
  const icon  = '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge,
      tag:     data.type || 'general',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
