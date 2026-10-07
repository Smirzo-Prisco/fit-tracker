// Store in-memory dei challenge WebAuthn pendenti, chiave per attemptId. Un solo
// worker pm2: non serve un backing store condiviso (Redis/DB) per questo — ma con
// più utenti serve comunque distinguere tentativi concorrenti (due persone che
// fanno login/enrollment vicine nel tempo), altrimenti si sovrascriverebbero a
// vicenda l'un l'altra una singola variabile globale (bug reale, non solo teorico,
// col secondo utente aggiunto).
const crypto = require('crypto');

const pending = new Map();

// Scadenza di sicurezza: un attemptId mai completato (tab abbandonata) non deve
// restare in memoria per sempre.
const TTL_MS = 5 * 60 * 1000;

module.exports = {
  create(data) {
    const attemptId = crypto.randomUUID();
    pending.set(attemptId, { ...data, scadenza: Date.now() + TTL_MS });
    return attemptId;
  },
  get(attemptId) {
    const entry = pending.get(attemptId);
    if (!entry) return null;
    if (Date.now() > entry.scadenza) {
      pending.delete(attemptId);
      return null;
    }
    return entry;
  },
  clear(attemptId) {
    pending.delete(attemptId);
  },
};
