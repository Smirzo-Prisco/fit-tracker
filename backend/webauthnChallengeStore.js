// Store in-memory del challenge WebAuthn pendente. App mono-utente e mono-processo
// (un solo worker pm2): non serve un backing store condiviso (Redis/DB) per questo.
let pendingChallenge = null;

module.exports = {
  set(challenge) {
    pendingChallenge = challenge;
  },
  get() {
    return pendingChallenge;
  },
  clear() {
    pendingChallenge = null;
  },
};
