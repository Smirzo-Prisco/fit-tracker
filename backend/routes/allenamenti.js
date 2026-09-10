const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// Deve restare in sync con frontend/src/lib/gruppiMuscolari.js e con la stessa
// costante in routes/esercizi.js — usata qui solo per validare il filtro di
// GET /andamento, non per scrivere dati.
const GRUPPI_MUSCOLARI = ['Petto', 'Dorsali', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Addominali'];

// Punteggio di carico (Training Load Score) di una serie: ripetizioni × peso_kg × (RPE/10).
// Richiede tutti e tre i valori — una serie senza RPE (es. dati storici pre-funzionalità)
// non entra nel punteggio invece di essere trattata come 0, per non falsare l'andamento.
function punteggioSerie(s) {
  if (s.ripetizioni == null || s.peso_kg == null || s.rpe == null) return null;
  return Number(s.ripetizioni) * Number(s.peso_kg) * (Number(s.rpe) / 10);
}

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

    // Punteggio per card: reale (solo dati davvero registrati) e previsto (come nel
    // dettaglio allenamento, ma a livello di esercizio invece che di singola serie —
    // per ogni esercizio usa il suo punteggio reale in QUESTO allenamento se presente,
    // altrimenti l'ultimo reale noto da un allenamento precedente per lo stesso
    // esercizio). Un solo giro in ordine cronologico: "ultimo noto" si aggiorna man
    // mano, così ogni allenamento vede solo ciò che è realmente accaduto prima di lui.
    const [aeRows] = await pool.query(
      `SELECT ae.allenamento_id, ae.esercizio_id, a.data,
              SUM(s.ripetizioni * s.peso_kg * (s.rpe / 10)) AS reale_esercizio
       FROM allenamento_esercizi ae
       JOIN allenamenti a ON a.id = ae.allenamento_id
       LEFT JOIN serie s ON s.allenamento_esercizio_id = ae.id
       WHERE a.utente_id = ?
       GROUP BY ae.id, ae.allenamento_id, ae.esercizio_id, a.data
       ORDER BY a.data ASC, a.id ASC`,
      [req.utenteId]
    );

    const ultimoRealeNoto = {}; // esercizio_id -> ultimo punteggio reale noto
    const perAllenamento = {}; // allenamento_id -> { realeSum, realeCount, proiettatoSum, proiettatoCount }
    for (const row of aeRows) {
      const agg = (perAllenamento[row.allenamento_id] ||= {
        realeSum: 0,
        realeCount: 0,
        proiettatoSum: 0,
        proiettatoCount: 0,
      });
      const realeEs = row.reale_esercizio != null ? Number(row.reale_esercizio) : null;
      if (realeEs != null) {
        agg.realeSum += realeEs;
        agg.realeCount += 1;
      }
      const baseline = realeEs != null ? realeEs : ultimoRealeNoto[row.esercizio_id];
      if (baseline != null) {
        agg.proiettatoSum += baseline;
        agg.proiettatoCount += 1;
      }
      if (realeEs != null) ultimoRealeNoto[row.esercizio_id] = realeEs;
    }

    res.json(
      rows.map((a) => {
        const agg = perAllenamento[a.id];
        return {
          ...a,
          punteggio_reale: agg && agg.realeCount > 0 ? Math.round(agg.realeSum) : null,
          punteggio_previsto: agg && agg.proiettatoCount > 0 ? Math.round(agg.proiettatoSum) : null,
        };
      })
    );
  })
);

// Andamento settimanale del punteggio di carico, per il pannello "Monitoraggio" in Dashboard.
// Settimana lun-dom (WEEKDAY: 0=lun...6=dom), stessa convenzione di inizioSettimana() nel frontend.
// Deve stare PRIMA di GET /:id, altrimenti Express interpreterebbe "andamento" come un :id.
router.get(
  '/andamento',
  asyncHandler(async (req, res) => {
    const settimane = Math.min(Math.max(parseInt(req.query.settimane, 10) || 12, 1), 52);
    const gruppoMuscolare = req.query.gruppo_muscolare || null;
    if (gruppoMuscolare && !GRUPPI_MUSCOLARI.includes(gruppoMuscolare)) {
      return res.status(400).json({ error: 'Gruppo muscolare non valido' });
    }
    const [rows] = await pool.query(
      `SELECT
         DATE_SUB(a.data, INTERVAL WEEKDAY(a.data) DAY) AS settimana_inizio,
         SUM(s.ripetizioni * s.peso_kg * (s.rpe / 10)) AS punteggio_totale,
         AVG(s.rpe) AS rpe_medio,
         COUNT(s.id) AS numero_set
       FROM serie s
       JOIN allenamento_esercizi ae ON ae.id = s.allenamento_esercizio_id
       JOIN allenamenti a ON a.id = ae.allenamento_id
       JOIN esercizi e ON e.id = ae.esercizio_id
       WHERE a.utente_id = ?
         AND s.ripetizioni IS NOT NULL AND s.peso_kg IS NOT NULL AND s.rpe IS NOT NULL
         ${gruppoMuscolare ? 'AND e.gruppo_muscolare = ?' : ''}
       GROUP BY settimana_inizio
       ORDER BY settimana_inizio DESC
       LIMIT ?`,
      gruppoMuscolare ? [req.utenteId, gruppoMuscolare, settimane] : [req.utenteId, settimane]
    );
    res.json(
      rows
        .reverse()
        .map((r) => ({
          settimana_inizio: r.settimana_inizio,
          punteggio_totale: Math.round(Number(r.punteggio_totale)),
          rpe_medio: Number(r.rpe_medio),
          numero_set: r.numero_set,
        }))
    );
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
    let punteggioTotale = 0;
    if (esercizi.length > 0) {
      const [serieRows] = await pool.query(
        `SELECT * FROM serie WHERE allenamento_esercizio_id IN (?) ORDER BY numero_serie ASC`,
        [esercizi.map((e) => e.id)]
      );
      serieMap = serieRows.reduce((acc, s) => {
        const punteggio = punteggioSerie(s);
        if (punteggio != null) punteggioTotale += punteggio;
        (acc[s.allenamento_esercizio_id] ||= []).push({ ...s, punteggio });
        return acc;
      }, {});
    }

    // Allenamento precedente (l'intero, non solo gli esercizi in comune): stesso
    // principio dell'EXISTS in /esercizi/:id/ultima-sessione — un allenamento
    // pianificato ma ancora vuoto non deve mai contare come "precedente" solo
    // perché ha una data più vicina a oggi.
    const [precedenteRows] = await pool.query(
      `SELECT a2.id, a2.data, SUM(s.ripetizioni * s.peso_kg * (s.rpe / 10)) AS punteggio_totale
       FROM allenamenti a2
       JOIN allenamento_esercizi ae2 ON ae2.allenamento_id = a2.id
       JOIN serie s ON s.allenamento_esercizio_id = ae2.id
       WHERE a2.utente_id = ? AND a2.id != ?
         AND s.ripetizioni IS NOT NULL AND s.peso_kg IS NOT NULL AND s.rpe IS NOT NULL
       GROUP BY a2.id
       ORDER BY a2.data DESC, a2.id DESC
       LIMIT 1`,
      [req.utenteId, allenamento.id]
    );
    const precedente = precedenteRows[0]
      ? { data: precedenteRows[0].data, punteggio_totale: Math.round(Number(precedenteRows[0].punteggio_totale)) }
      : null;

    res.json({
      ...allenamento,
      punteggio_totale: punteggioTotale || null,
      allenamento_precedente: precedente,
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

    const { ripetizioni, peso_kg, rpe } = req.body;
    const [[{ conteggio }]] = await pool.query(
      'SELECT COUNT(*) AS conteggio FROM serie WHERE allenamento_esercizio_id = ?',
      [req.params.aeId]
    );
    const [result] = await pool.query(
      'INSERT INTO serie (allenamento_esercizio_id, numero_serie, ripetizioni, peso_kg, rpe) VALUES (?, ?, ?, ?, ?)',
      [req.params.aeId, conteggio + 1, ripetizioni || null, peso_kg || null, rpe || null]
    );
    res.status(201).json({
      id: result.insertId,
      numero_serie: conteggio + 1,
      punteggio: punteggioSerie({ ripetizioni, peso_kg, rpe }),
    });
  })
);

router.put(
  '/:id/esercizi/:aeId/serie/:serieId',
  asyncHandler(async (req, res) => {
    const ae = await trovaAllenamentoEsercizio(req.utenteId, req.params.id, req.params.aeId);
    if (!ae) return res.status(404).json({ error: 'Esercizio non trovato in questo allenamento' });

    const { ripetizioni, peso_kg, rpe } = req.body;
    await pool.query(
      'UPDATE serie SET ripetizioni = ?, peso_kg = ?, rpe = ? WHERE id = ? AND allenamento_esercizio_id = ?',
      [ripetizioni || null, peso_kg || null, rpe || null, req.params.serieId, req.params.aeId]
    );
    res.json({ ok: true, punteggio: punteggioSerie({ ripetizioni, peso_kg, rpe }) });
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
