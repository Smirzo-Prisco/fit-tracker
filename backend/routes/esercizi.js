const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const asyncHandler = require('../middleware/asyncHandler');

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

// Catalogo: quante volte ogni esercizio è stato usato, per ordinarlo e capire cosa è "in uso"
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT e.*, COUNT(ae.id) AS volte_usato
       FROM esercizi e
       LEFT JOIN allenamento_esercizi ae ON ae.esercizio_id = e.id
       GROUP BY e.id
       ORDER BY e.nome ASC`
    );
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { nome, immagine_url, gruppo_muscolare } = req.body;
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Il nome è obbligatorio' });
    }
    try {
      const [result] = await pool.query(
        'INSERT INTO esercizi (nome, immagine_url, gruppo_muscolare) VALUES (?, ?, ?)',
        [nome.trim(), immagine_url || null, gruppo_muscolare || null]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Esiste già un esercizio con questo nome' });
      }
      throw err;
    }
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { nome, immagine_url, gruppo_muscolare } = req.body;
    try {
      await pool.query('UPDATE esercizi SET nome = ?, immagine_url = ?, gruppo_muscolare = ? WHERE id = ?', [
        nome.trim(),
        immagine_url || null,
        gruppo_muscolare || null,
        req.params.id,
      ]);
      res.json({ ok: true });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Esiste già un esercizio con questo nome' });
      }
      throw err;
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
      `SELECT a.data, s.numero_serie, s.ripetizioni, s.peso_kg
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

module.exports = router;
