const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

const CAMPI = ['data', 'peso_kg', 'braccio_cm', 'torace_cm', 'vita_cm', 'fianchi_cm', 'coscia_cm', 'polpaccio_cm', 'note'];

router.get('/', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM misurazioni WHERE utente_id = ? ORDER BY data DESC, id DESC',
    [req.utenteId]
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const valori = CAMPI.map((campo) => req.body[campo] ?? null);
  const [result] = await pool.query(
    `INSERT INTO misurazioni (utente_id, ${CAMPI.join(', ')}) VALUES (?, ${CAMPI.map(() => '?').join(', ')})`,
    [req.utenteId, ...valori]
  );
  res.status(201).json({ id: result.insertId });
});

router.put('/:id', async (req, res) => {
  const valori = CAMPI.map((campo) => req.body[campo] ?? null);
  await pool.query(
    `UPDATE misurazioni SET ${CAMPI.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND utente_id = ?`,
    [...valori, req.params.id, req.utenteId]
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM misurazioni WHERE id = ? AND utente_id = ?', [req.params.id, req.utenteId]);
  res.json({ ok: true });
});

module.exports = router;
