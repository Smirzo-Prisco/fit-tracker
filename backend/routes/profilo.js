const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nome, altezza_cm, data_nascita FROM utente WHERE id = ?',
    [req.utenteId]
  );
  res.json(rows[0] || null);
});

router.put('/', async (req, res) => {
  const { nome, altezza_cm, data_nascita } = req.body;
  await pool.query(
    'UPDATE utente SET nome = ?, altezza_cm = ?, data_nascita = ? WHERE id = ?',
    [nome, altezza_cm, data_nascita, req.utenteId]
  );
  res.json({ ok: true });
});

module.exports = router;
