const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// Verifica che l'allenamento_esercizio indicato appartenga a un allenamento dell'utente,
// e restituisce l'allenamento_id per comodità (evita un giro extra di query ai chiamanti).
async function trovaAllenamentoEsercizio(utenteId, allenamentoId, aeId) {
  const [rows] = await pool.query(
    `SELECT ae.id FROM allenamento_esercizi ae
     JOIN allenamenti a ON a.id = ae.allenamento_id
     WHERE ae.id = ? AND ae.allenamento_id = ? AND a.utente_id = ?`,
    [aeId, allenamentoId, utenteId]
  );
  return rows[0] || null;
}

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

    let serieMap = {};
    if (esercizi.length > 0) {
      const [serieRows] = await pool.query(
        `SELECT * FROM serie WHERE allenamento_esercizio_id IN (?) ORDER BY numero_serie ASC`,
        [esercizi.map((e) => e.id)]
      );
      serieMap = serieRows.reduce((acc, s) => {
        (acc[s.allenamento_esercizio_id] ||= []).push(s);
        return acc;
      }, {});
    }

    res.json({
      ...allenamento,
      esercizi: esercizi.map((e) => ({ ...e, serie: serieMap[e.id] || [] })),
    });
  })
);

// Crea l'allenamento con solo la data (di norma chiamata subito all'apertura di "Nuovo allenamento",
// così ogni azione successiva ha già un id su cui salvare istantaneamente).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { data, durata_min, note, scheda_id } = req.body;
    const [result] = await pool.query(
      'INSERT INTO allenamenti (utente_id, scheda_id, data, durata_min, note) VALUES (?, ?, ?, ?, ?)',
      [req.utenteId, scheda_id || null, data, durata_min || null, note || null]
    );
    res.status(201).json({ id: result.insertId });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { data, durata_min, note, scheda_id } = req.body;
    const [result] = await pool.query(
      'UPDATE allenamenti SET data = ?, durata_min = ?, note = ?, scheda_id = ? WHERE id = ? AND utente_id = ?',
      [data, durata_min || null, note || null, scheda_id || null, req.params.id, req.utenteId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Allenamento non trovato' });
    }
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await pool.query('DELETE FROM allenamenti WHERE id = ? AND utente_id = ?', [req.params.id, req.utenteId]);
    res.json({ ok: true });
  })
);

// --- Esercizi dell'allenamento (aggiunti/rimossi uno alla volta, salvataggio istantaneo) ---

router.post(
  '/:id/esercizi',
  asyncHandler(async (req, res) => {
    const [allenamentoRows] = await pool.query('SELECT id FROM allenamenti WHERE id = ? AND utente_id = ?', [
      req.params.id,
      req.utenteId,
    ]);
    if (!allenamentoRows[0]) {
      return res.status(404).json({ error: 'Allenamento non trovato' });
    }
    const [[{ conteggio }]] = await pool.query(
      'SELECT COUNT(*) AS conteggio FROM allenamento_esercizi WHERE allenamento_id = ?',
      [req.params.id]
    );
    const [result] = await pool.query(
      'INSERT INTO allenamento_esercizi (allenamento_id, esercizio_id, ordine) VALUES (?, ?, ?)',
      [req.params.id, req.body.esercizio_id, conteggio]
    );
    const [esercizioRows] = await pool.query('SELECT nome, immagine_url FROM esercizi WHERE id = ?', [
      req.body.esercizio_id,
    ]);
    res.status(201).json({
      id: result.insertId,
      esercizio_id: req.body.esercizio_id,
      ordine: conteggio,
      serie: [],
      ...esercizioRows[0],
    });
  })
);

router.delete(
  '/:id/esercizi/:aeId',
  asyncHandler(async (req, res) => {
    const ae = await trovaAllenamentoEsercizio(req.utenteId, req.params.id, req.params.aeId);
    if (!ae) return res.status(404).json({ error: 'Esercizio non trovato in questo allenamento' });
    await pool.query('DELETE FROM allenamento_esercizi WHERE id = ?', [req.params.aeId]);
    res.json({ ok: true });
  })
);

// --- Serie di un esercizio (una riga per set, salvataggio istantaneo su blur del campo) ---

router.post(
  '/:id/esercizi/:aeId/serie',
  asyncHandler(async (req, res) => {
    const ae = await trovaAllenamentoEsercizio(req.utenteId, req.params.id, req.params.aeId);
    if (!ae) return res.status(404).json({ error: 'Esercizio non trovato in questo allenamento' });

    const { ripetizioni, peso_kg } = req.body;
    const [[{ conteggio }]] = await pool.query(
      'SELECT COUNT(*) AS conteggio FROM serie WHERE allenamento_esercizio_id = ?',
      [req.params.aeId]
    );
    const [result] = await pool.query(
      'INSERT INTO serie (allenamento_esercizio_id, numero_serie, ripetizioni, peso_kg) VALUES (?, ?, ?, ?)',
      [req.params.aeId, conteggio + 1, ripetizioni || null, peso_kg || null]
    );
    res.status(201).json({ id: result.insertId, numero_serie: conteggio + 1 });
  })
);

router.put(
  '/:id/esercizi/:aeId/serie/:serieId',
  asyncHandler(async (req, res) => {
    const ae = await trovaAllenamentoEsercizio(req.utenteId, req.params.id, req.params.aeId);
    if (!ae) return res.status(404).json({ error: 'Esercizio non trovato in questo allenamento' });

    const { ripetizioni, peso_kg } = req.body;
    await pool.query('UPDATE serie SET ripetizioni = ?, peso_kg = ? WHERE id = ? AND allenamento_esercizio_id = ?', [
      ripetizioni || null,
      peso_kg || null,
      req.params.serieId,
      req.params.aeId,
    ]);
    res.json({ ok: true });
  })
);

router.delete(
  '/:id/esercizi/:aeId/serie/:serieId',
  asyncHandler(async (req, res) => {
    const ae = await trovaAllenamentoEsercizio(req.utenteId, req.params.id, req.params.aeId);
    if (!ae) return res.status(404).json({ error: 'Esercizio non trovato in questo allenamento' });
    await pool.query('DELETE FROM serie WHERE id = ? AND allenamento_esercizio_id = ?', [
      req.params.serieId,
      req.params.aeId,
    ]);
    res.json({ ok: true });
  })
);

module.exports = router;
