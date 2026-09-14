// PushNotifications — gerencia subscription de Web Push
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BPbiZAUlrcVxOq5S_ckhnrtOJvfV6kHdq154iEy_K-O8KlqRPRLwTGVXCjKotjVFggXbG6Txkk_u50Inb8KJmlo';

function urlBase64ToUint8Array(base64String) {
  const padding  = '='.repeat((4 - base64String.length % 4) % 4);
  const base64   = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData  = window.atob(base64);
  return Uint8Array.from([...rawData].map(c=>c.charCodeAt(0)));
}

export default function PushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    async function subscribe() {
      try {
        const reg         = await navigator.serviceWorker.ready;
        const existing    = await reg.pushManager.getSubscription();
        if (existing) { await sendToServer(existing); return; }

        const permission  = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly:      true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
        });
        await sendToServer(subscription);
      } catch(e) { console.warn('Push subscription error:', e); }
    }

    async function sendToServer(sub) {
      try {
        await api.post('/api/notifications/subscribe', { subscription: sub.toJSON() });
      } catch {}
    }

    // Aguarda SW estar pronto e tenta subscription
    const timer = setTimeout(subscribe, 3000);
    return () => clearTimeout(timer);
  }, [user]);

  return null;
}
