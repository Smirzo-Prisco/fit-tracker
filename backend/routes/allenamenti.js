const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

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

// Suggerimenti autocomplete: nomi esercizio già usati, con l'ultima immagine associata
router.get('/suggerimenti-esercizi', async (req, res) => {
  const q = (req.query.q || '').trim();
  const [rows] = await pool.query(
    `SELECT nome, immagine_url FROM (
       SELECT ae.nome, ae.immagine_url, ae.allenamento_id,
              ROW_NUMBER() OVER (PARTITION BY ae.nome ORDER BY ae.allenamento_id DESC) AS rn
       FROM allenamento_esercizi ae
       JOIN allenamenti a ON a.id = ae.allenamento_id
       WHERE a.utente_id = ? AND ae.nome LIKE ?
     ) ultime
     WHERE rn = 1
     ORDER BY allenamento_id DESC
     LIMIT 10`,
    [req.utenteId, `%${q}%`]
  );
  res.json(rows);
});

// Progressione peso/ripetizioni nel tempo per un nome esercizio (case-insensitive)
router.get('/progressione/:nome', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.data, ae.serie, ae.ripetizioni, ae.peso_kg
     FROM allenamento_esercizi ae
     JOIN allenamenti a ON a.id = ae.allenamento_id
     WHERE a.utente_id = ? AND LOWER(ae.nome) = LOWER(?)
     ORDER BY a.data ASC, ae.id ASC`,
    [req.utenteId, req.params.nome]
  );
  res.json(rows);
});

// Elenco completo dei nomi esercizio distinti usati (per lo storico/progressione)
router.get('/nomi-esercizi', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT nome, immagine_url, volte, ultima_volta FROM (
       SELECT ae.nome, ae.immagine_url, ae.allenamento_id, a.data AS ultima_volta,
              ROW_NUMBER() OVER (PARTITION BY ae.nome ORDER BY ae.allenamento_id DESC) AS rn,
              COUNT(*) OVER (PARTITION BY ae.nome) AS volte
       FROM allenamento_esercizi ae
       JOIN allenamenti a ON a.id = ae.allenamento_id
       WHERE a.utente_id = ?
     ) t
     WHERE rn = 1
     ORDER BY ultima_volta DESC`,
    [req.utenteId]
  );
  res.json(rows);
});

router.get('/', async (req, res) => {
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
});

router.get('/:id', async (req, res) => {
  const [allenamentoRows] = await pool.query(
    'SELECT * FROM allenamenti WHERE id = ? AND utente_id = ?',
    [req.params.id, req.utenteId]
  );
  const allenamento = allenamentoRows[0];
  if (!allenamento) {
    return res.status(404).json({ error: 'Allenamento non trovato' });
  }
  const [esercizi] = await pool.query(
    'SELECT * FROM allenamento_esercizi WHERE allenamento_id = ? ORDER BY ordine ASC, id ASC',
    [allenamento.id]
  );
  res.json({ ...allenamento, esercizi });
});

async function salvaEsercizi(connection, allenamentoId, esercizi) {
  if (!Array.isArray(esercizi)) return;
  for (let i = 0; i < esercizi.length; i += 1) {
    const e = esercizi[i];
    await connection.query(
      `INSERT INTO allenamento_esercizi
        (allenamento_id, nome, immagine_url, serie, ripetizioni, peso_kg, ordine)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [allenamentoId, e.nome, e.immagine_url || null, e.serie || null, e.ripetizioni || null, e.peso_kg || null, i]
    );
  }
}

router.post('/', async (req, res) => {
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
});

router.put('/:id', async (req, res) => {
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
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM allenamenti WHERE id = ? AND utente_id = ?', [req.params.id, req.utenteId]);
  res.json({ ok: true });
});

module.exports = router;
