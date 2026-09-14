const CACHE_NAME = 'ei-v1';
self.addEventListener('install', ()=>self.skipWaiting());
self.addEventListener('activate', e=>e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  if (!e.data) return;
  let payload = { title:'Ei! Finanças', body:'Nova notificação', url:'/' };
  try { payload = { ...payload, ...JSON.parse(e.data.text()) }; } catch {}
  e.waitUntil(self.registration.showNotification(payload.title, {
    body:payload.body, icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png', tag:'ei-notification',
    data:{ url:payload.url }, vibrate:[200,100,200],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    const c = cs.find(c=>c.url.includes(self.location.origin));
    if(c){c.focus();c.navigate(url);} else clients.openWindow(url);
  }));
});
