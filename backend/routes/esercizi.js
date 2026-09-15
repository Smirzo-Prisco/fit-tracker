const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// Deve restare in sync con frontend/src/lib/gruppiMuscolari.js — vedi lì il perché
// di un set fisso invece di testo libero (reportistica per gruppo muscolare).
const GRUPPI_MUSCOLARI = ['Petto', 'Dorsali', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Addominali'];

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'esercizi');
const ESTENSIONI_CONSENTITE = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ESTENSIONI_CONSENTITE.has(ext)) {
      return cb(new Error('Formato immagine non supportato'));
    }
    cb(null, true);
  },
});

router.post('/upload-immagine', upload.single('immagine'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nessuna immagine caricata' });
  }
  res.json({ immagine_url: `/uploads/esercizi/${req.file.filename}` });
});

// Valida l'array { gruppo_muscolare, percentuale } inviato dal form: gruppi noti,
// percentuale 1-100, nessun gruppo ripetuto (la PK composta lo impedirebbe comunque,
// ma qui vogliamo un messaggio d'errore leggibile invece di un ER_DUP_ENTRY).
function validaGruppiMuscolari(gruppi) {
  if (!Array.isArray(gruppi)) return 'Formato gruppi muscolari non valido';
  const visti = new Set();
  for (const g of gruppi) {
    if (!GRUPPI_MUSCOLARI.includes(g.gruppo_muscolare)) return 'Gruppo muscolare non valido';
    const percentuale = Number(g.percentuale);
    if (!Number.isInteger(percentuale) || percentuale < 1 || percentuale > 100) {
      return 'La percentuale deve essere un numero intero tra 1 e 100';
    }
    if (visti.has(g.gruppo_muscolare)) return 'Ogni gruppo muscolare può comparire una sola volta';
    visti.add(g.gruppo_muscolare);
  }
  return null;
}

// Sostituisce le righe di esercizio_gruppi_muscolari per un esercizio (usato sia da
// POST che da PUT): più semplice e meno soggetto a errori di un diff riga per riga.
async function salvaGruppiMuscolari(connessione, esercizioId, gruppi) {
  await connessione.query('DELETE FROM esercizio_gruppi_muscolari WHERE esercizio_id = ?', [esercizioId]);
  if (gruppi.length === 0) return;
  await connessione.query('INSERT INTO esercizio_gruppi_muscolari (esercizio_id, gruppo_muscolare, percentuale) VALUES ?', [
    gruppi.map((g) => [esercizioId, g.gruppo_muscolare, Number(g.percentuale)]),
  ]);
}

// Catalogo: quante volte ogni esercizio è stato usato (per ordinarlo/capire cosa è "in
// uso") più i gruppi muscolari allenati. Query separata invece di JSON_ARRAYAGG per non
// legare il progetto a una versione minima di MySQL.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [esercizi] = await pool.query(
      `SELECT e.*, COUNT(ae.id) AS volte_usato
       FROM esercizi e
       LEFT JOIN allenamento_esercizi ae ON ae.esercizio_id = e.id
       GROUP BY e.id
       ORDER BY e.nome ASC`
    );
    const [gruppi] = await pool.query(
      'SELECT esercizio_id, gruppo_muscolare, percentuale FROM esercizio_gruppi_muscolari ORDER BY percentuale DESC'
    );
    const gruppiPerEsercizio = new Map();
    for (const g of gruppi) {
      if (!gruppiPerEsercizio.has(g.esercizio_id)) gruppiPerEsercizio.set(g.esercizio_id, []);
      gruppiPerEsercizio.get(g.esercizio_id).push({ gruppo_muscolare: g.gruppo_muscolare, percentuale: g.percentuale });
    }
    res.json(esercizi.map((e) => ({ ...e, gruppi_muscolari: gruppiPerEsercizio.get(e.id) || [] })));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nome, immagine_url, gruppi_muscolari } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Il nome è obbligatorio' });
    }
    const gruppi = gruppi_muscolari || [];
    const erroreGruppi = validaGruppiMuscolari(gruppi);
    if (erroreGruppi) return res.status(400).json({ error: erroreGruppi });

    const connessione = await pool.getConnection();
    try {
      await connessione.beginTransaction();
      const [result] = await connessione.query('INSERT INTO esercizi (nome, immagine_url) VALUES (?, ?)', [
        nome.trim(),
        immagine_url || null,
      ]);
      await salvaGruppiMuscolari(connessione, result.insertId, gruppi);
      await connessione.commit();
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      await connessione.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Esiste già un esercizio con questo nome' });
      }
      throw err;
    } finally {
      connessione.release();
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { nome, immagine_url, gruppi_muscolari } = req.body;
    const gruppi = gruppi_muscolari || [];
    const erroreGruppi = validaGruppiMuscolari(gruppi);
    if (erroreGruppi) return res.status(400).json({ error: erroreGruppi });

    const connessione = await pool.getConnection();
    try {
      await connessione.beginTransaction();
      await connessione.query('UPDATE esercizi SET nome = ?, immagine_url = ? WHERE id = ?', [
        nome.trim(),
        immagine_url || null,
        req.params.id,
      ]);
      await salvaGruppiMuscolari(connessione, req.params.id, gruppi);
      await connessione.commit();
      res.json({ ok: true });
    } catch (err) {
      await connessione.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Esiste già un esercizio con questo nome' });
      }
      throw err;
    } finally {
      connessione.release();
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    try {
      await pool.query('DELETE FROM esercizi WHERE id = ?', [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        return res.status(409).json({ error: 'Non puoi eliminare un esercizio già usato in un allenamento' });
      }
      throw err;
    }
  })
);

// Progressione peso/ripetizioni nel tempo per un esercizio del catalogo (tutte le serie di ogni sessione)
router.get(
  '/:id/progressione',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT a.data, s.numero_serie, s.ripetizioni, s.peso_kg, s.rpe
       FROM serie s
       JOIN allenamento_esercizi ae ON ae.id = s.allenamento_esercizio_id
       JOIN allenamenti a ON a.id = ae.allenamento_id
       WHERE a.utente_id = ? AND ae.esercizio_id = ?
       ORDER BY a.data ASC, s.numero_serie ASC`,
      [req.utenteId, req.params.id]
    );
    res.json(rows);
  })
);

// Serie dell'ultima volta che l'esercizio è stato svolto (in un allenamento diverso da
// quello indicato in ?escludi) — usata da NuovoAllenamento per precompilare le serie
// come placeholder e calcolare il punteggio di riferimento da battere.
router.get(
  '/:id/ultima-sessione',
  asyncHandler(async (req, res) => {
    const escludiAllenamento = parseInt(req.query.escludi, 10) || 0;
    const [riferimento] = await pool.query(
      // EXISTS: un allenamento preparato in anticipo ma non ancora svolto (nessuna
      // serie salvata) non deve mai passare per "ultima sessione" solo perché ha una
      // data più recente di quella vera — altrimenti i placeholder di un allenamento
      // vecchio ma già completato spariscono a favore di uno futuro ancora vuoto.
      `SELECT ae.id, a.data
       FROM allenamento_esercizi ae
       JOIN allenamenti a ON a.id = ae.allenamento_id
       WHERE ae.esercizio_id = ? AND a.utente_id = ? AND a.id != ?
         AND EXISTS (SELECT 1 FROM serie s WHERE s.allenamento_esercizio_id = ae.id)
       ORDER BY a.data DESC, a.id DESC
       LIMIT 1`,
      [req.params.id, req.utenteId, escludiAllenamento]
    );
    if (!riferimento[0]) return res.json({ data: null, serie: [] });

    const [serie] = await pool.query(
      'SELECT ripetizioni, peso_kg, rpe FROM serie WHERE allenamento_esercizio_id = ? ORDER BY numero_serie ASC',
      [riferimento[0].id]
    );
    res.json({ data: riferimento[0].data, serie });
  })
);

module.exports = router;
