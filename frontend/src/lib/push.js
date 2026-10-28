import { api } from './api';

// Il browser vuole la chiave VAPID come Uint8Array, non come la stringa
// base64url che arriva dal server.
function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Richiede il permesso e sottoscrive questo dispositivo alle push — va
// chiamata da un gesto utente esplicito (un click), su iOS/Safari una
// richiesta automatica silenziosa viene ignorata o bloccata.
export async function abilitaPush() {
  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') {
    throw new Error('Permesso per le notifiche negato');
  }

  const registration = await navigator.serviceWorker.ready;
  const { chiave } = await api.get('/notifiche/vapid-public-key');
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(chiave),
  });

  const json = subscription.toJSON();
  await api.post('/notifiche/push-subscription', { endpoint: json.endpoint, keys: json.keys });
}

export function pushSupportato() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
