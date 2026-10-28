import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './lib/AuthContext.jsx';
import App from './App.jsx';
import './styles.css';

// Senza questo import, vite-plugin-pwa genera solo un registerSW.js minimale
// (register + basta, nessuna gestione aggiornamenti): il nuovo service worker
// prendeva il controllo subito (skipWaiting/clientsClaim in sw.js) ma nessuno
// ricaricava la tab già aperta, quindi restava comunque sul bundle vecchio
// finché l'utente non faceva un hard refresh manuale. Con registerType
// 'autoUpdate' (vite.config.js), questa chiamata ricarica automaticamente la
// pagina non appena un nuovo service worker è attivo.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
