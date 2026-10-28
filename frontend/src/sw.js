import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Con la strategia injectManifest (necessaria per i listener push sotto),
// vite-plugin-pwa NON aggiunge da solo skipWaiting/clientsClaim come fa invece
// con generateSW — senza, ogni nuova versione del service worker restava "in
// attesa" indefinitamente (finché l'app non veniva chiusa del tutto, mai su
// una PWA installata) e l'app continuava a servire la build vecchia dalla
// cache anche dopo un deploy riuscito. Questi due fanno sì che la nuova
// versione prenda il controllo subito, al prossimo avvio dell'app.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.titolo || 'Fit Tracker', {
      body: data.corpo || '',
      icon: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/profilo'));
});
