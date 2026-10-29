import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest invece del generateSW di default: serve il nostro
      // sw.js con i listener push/notificationclick per le notifiche.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Fit Tracker',
        short_name: 'Fit Tracker',
        description: 'Monitoraggio peso, circonferenze e allenamenti',
        theme_color: '#1e6feb',
        background_color: '#0b0f14',
        display: 'standalone',
        start_url: '/',
        // nginx serve questi file con 30 giorni di cache (location ~* \.(png|...)$),
        // e i nomi file sono fissi (non content-hashed come i bundle JS/CSS): senza
        // una query string che cambia, i browser continuano a servire l'icona vecchia
        // dalla cache per settimane anche dopo un deploy riuscito. Incrementare ?v=
        // ogni volta che l'icona viene aggiornata.
        icons: [
          { src: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4001',
      '/uploads': 'http://127.0.0.1:4001',
    },
  },
});
