const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT s.*, COUNT(se.id) AS numero_esercizi
       FROM schede s
       LEFT JOIN scheda_esercizi se ON se.scheda_id = s.id
       WHERE s.utente_id = ?
       GROUP BY s.id
       ORDER BY s.nome ASC`,
      [req.utenteId]
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [schedaRows] = await pool.query('SELECT * FROM schede WHERE id = ? AND utente_id = ?', [
      req.params.id,
      req.utenteId,
    ]);
    const scheda = schedaRows[0];
    if (!scheda) {
      return res.status(404).json({ error: 'Scheda non trovata' });
    }
    const [esercizi] = await pool.query(
      `SELECT se.id, se.esercizio_id, se.ordine, e.nome, e.immagine_url
       FROM scheda_esercizi se
       JOIN esercizi e ON e.id = se.esercizio_id
       WHERE se.scheda_id = ?
       ORDER BY se.ordine ASC, se.id ASC`,
      [scheda.id]
    );
    res.json({ ...scheda, esercizi });
  })
);

// L'esercizio deve appartenere a chi sta scrivendo la scheda — il catalogo
// non è più condiviso (vedi esercizi.js), altrimenti si potrebbe agganciare
// alla propria scheda l'id di un esercizio di un altro utente.
async function salvaEsercizi(connection, schedaId, esercizi, utenteId) {
  if (!Array.isArray(esercizi)) return null;
  for (let i = 0; i < esercizi.length; i += 1) {
    const [esercizioRows] = await connection.query('SELECT id FROM esercizi WHERE id = ? AND utente_id = ?', [
      esercizi[i].esercizio_id,
      utenteId,
    ]);
    if (!esercizioRows[0]) return 'Esercizio non trovato';
    await connection.query('INSERT INTO scheda_esercizi (scheda_id, esercizio_id, ordine) VALUES (?, ?, ?)', [
      schedaId,
      esercizi[i].esercizio_id,
      i,
    ]);
  }
  return null;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nome, esercizi } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Il nome è obbligatorio' });
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query('INSERT INTO schede (utente_id, nome) VALUES (?, ?)', [
        req.utenteId,
        nome.trim(),
      ]);
      const erroreEsercizi = await salvaEsercizi(connection, result.insertId, esercizi, req.utenteId);
      if (erroreEsercizi) {
        await connection.rollback();
        return res.status(400).json({ error: erroreEsercizi });
      }
      await connection.commit();
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { nome, esercizi } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'UPDATE schede SET nome = ? WHERE id = ? AND utente_id = ?',
        [nome.trim(), req.params.id, req.utenteId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Scheda non trovata' });
      }
      await connection.query('DELETE FROM scheda_esercizi WHERE scheda_id = ?', [req.params.id]);
      const erroreEsercizi = await salvaEsercizi(connection, req.params.id, esercizi, req.utenteId);
      if (erroreEsercizi) {
        await connection.rollback();
        return res.status(400).json({ error: erroreEsercizi });
      }
      await connection.commit();
      res.json({ ok: true });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM schede WHERE id = ? AND utente_id = ?', [req.params.id, req.utenteId]);
    res.json({ ok: true });
  })
);

module.exports = router;
