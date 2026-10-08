// Punteggio di carico (Training Load Score) di una serie: ripetizioni × (kg / 1RM di
// riferimento) × (RPE/10) — pesa la serie in base a quanto è vicina al meglio recente
// dell'utente su quell'esercizio, non al peso assoluto sollevato. riferimento1Rm è calcolato
// lato backend (vedi backend/lib/punteggioCarico.js e i campi riferimento_1rm restituiti da
// GET /esercizi/:id/progressione e /ultima-sessione) e va sempre passato esplicitamente:
// qui non viene ricalcolato, per avere un solo punto di verità sulla sua logica (migliore
// 1RM stimato nelle ultime 4 settimane, o di sempre come fallback).
// Unico punto di verità per questa formula lato frontend — importata ovunque serva invece di
// essere riscritta, così una modifica futura si fa in un solo posto.
export function punteggioSerie(ripetizioni, kg, rpe, riferimento1Rm) {
  if (!riferimento1Rm) return null;
  return ripetizioni * (kg / riferimento1Rm) * (rpe / 10);
}
