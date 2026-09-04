// Express 4 non inoltra automaticamente le promise rifiutate al middleware di errore:
// senza questo wrapper, un throw dentro un handler async lascerebbe la richiesta senza risposta.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = asyncHandler;
