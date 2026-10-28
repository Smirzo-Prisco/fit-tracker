const webpush = require('web-push');

// Finché le chiavi VAPID non sono configurate sul server, le push restano
// disattivate invece di far crashare l'intero processo al boot (setVapidDetails
// lancia un'eccezione sincrona se mancano) — il resto dell'app (login, dati)
// deve continuare a funzionare anche prima che le notifiche siano pronte.
const configurato = Boolean(
  process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);
if (configurato) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('VAPID non configurato: le notifiche push sono disattivate.');
}

module.exports = { webpush, configurato };
