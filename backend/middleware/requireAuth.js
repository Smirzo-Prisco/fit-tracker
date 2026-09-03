const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'Non autenticato' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.utenteId = payload.utenteId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessione non valida' });
  }
}

module.exports = requireAuth;
