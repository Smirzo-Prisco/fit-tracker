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
      `SELECT a.*, COUNT(ae.id) AS numero_esercizi
       FROM allenamenti a
       LEFT JOIN allenamento_esercizi ae ON ae.allenamento_id = a.id
       WHERE a.utente_id = ?
       GROUP BY a.id
       ORDER BY a.data DESC, a.id DESC`,
      [req.utenteId]
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [allenamentoRows] = await pool.query(
      'SELECT * FROM allenamenti WHERE id = ? AND utente_id = ?',
      [req.params.id, req.utenteId]
    );
    const allenamento = allenamentoRows[0];
    if (!allenamento) {
      return res.status(404).json({ error: 'Allenamento non trovato' });
    }
    const [esercizi] = await pool.query(
      `SELECT ae.*, e.nome, e.immagine_url
       FROM allenamento_esercizi ae
       JOIN esercizi e ON e.id = ae.esercizio_id
       WHERE ae.allenamento_id = ?
       ORDER BY ae.ordine ASC, ae.id ASC`,
      [allenamento.id]
    );
    res.json({ ...allenamento, esercizi });
  })
);

async function salvaEsercizi(connection, allenamentoId, esercizi) {
  if (!Array.isArray(esercizi)) return;
  for (let i = 0; i < esercizi.length; i += 1) {
    const e = esercizi[i];
    await connection.query(
      `INSERT INTO allenamento_esercizi
        (allenamento_id, esercizio_id, serie, ripetizioni, peso_kg, ordine)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [allenamentoId, e.esercizio_id, e.serie || null, e.ripetizioni || null, e.peso_kg || null, i]
    );
  }
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { data, durata_min, note, esercizi } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO allenamenti (utente_id, data, durata_min, note) VALUES (?, ?, ?, ?)',
        [req.utenteId, data, durata_min || null, note || null]
      );
      await salvaEsercizi(connection, result.insertId, esercizi);
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
    const { data, durata_min, note, esercizi } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'UPDATE allenamenti SET data = ?, durata_min = ?, note = ? WHERE id = ? AND utente_id = ?',
        [data, durata_min || null, note || null, req.params.id, req.utenteId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Allenamento non trovato' });
      }
      await connection.query('DELETE FROM allenamento_esercizi WHERE allenamento_id = ?', [req.params.id]);
      await salvaEsercizi(connection, req.params.id, esercizi);
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
    await pool.query('DELETE FROM allenamenti WHERE id = ? AND utente_id = ?', [req.params.id, req.utenteId]);
    res.json({ ok: true });
  })
);

module.exports = router;
