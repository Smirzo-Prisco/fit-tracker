const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { creaNotifica, inviaPush } = require('../lib/notifiche');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.tipo, n.titolo, n.corpo, n.creato_il, d.letta_il
     FROM notifiche_destinatari d
     JOIN notifiche n ON n.id = d.notifica_id
     WHERE d.utente_id = ?
     ORDER BY n.creato_il DESC`,
    [req.utenteId]
  );
  res.json(rows.map((r) => ({ ...r, letta: r.letta_il !== null })));
});

router.post('/:id/letta', requireAuth, async (req, res) => {
  await pool.query(
    'UPDATE notifiche_destinatari SET letta_il = NOW() WHERE notifica_id = ? AND utente_id = ? AND letta_il IS NULL',
    [req.params.id, req.utenteId]
  );
  res.json({ ok: true });
});

router.get('/vapid-public-key', requireAuth, (req, res) => {
  res.json({ chiave: process.env.VAPID_PUBLIC_KEY });
});

router.post('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  await pool.query(
    `INSERT INTO push_subscriptions (utente_id, endpoint, p256dh, auth)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE utente_id = VALUES(utente_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [req.utenteId, endpoint, keys.p256dh, keys.auth]
  );
  res.json({ ok: true });
});

router.delete('/push-subscription', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND utente_id = ?', [
    endpoint,
    req.utenteId,
  ]);
  res.json({ ok: true });
});

router.post('/pubblica', requireAuth, requireAdmin, async (req, res) => {
  const { titolo, corpo } = req.body;
  if (!titolo) {
    return res.status(400).json({ error: 'Titolo obbligatorio' });
  }

  const [utentiRows] = await pool.query('SELECT id FROM utente');
  const destinatariIds = utentiRows.map((r) => r.id);

  await creaNotifica(pool, {
    tipo: 'aggiornamento',
    titolo,
    corpo,
    creatoDa: req.utenteId,
    destinatariIds,
  });
  await inviaPush(pool, destinatariIds, { titolo, corpo });

  res.json({ ok: true });
});

module.exports = router;
