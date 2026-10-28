const pool = require('../db');

// Va sempre usato DOPO requireAuth nella chain: si appoggia a req.utenteId,
// già verificato da quello, e aggiunge solo il controllo del ruolo.
async function requireAdmin(req, res, next) {
  const [rows] = await pool.query('SELECT ruolo FROM utente WHERE id = ?', [req.utenteId]);
  if (!rows[0] || rows[0].ruolo !== 'admin') {
    return res.status(403).json({ error: 'Riservato agli amministratori' });
  }
  next();
}

module.exports = requireAdmin;
