// Punteggio di carico (Training Load Score) di una serie: ripetizioni × 1RM stimato × (RPE/10).
// L'1RM stimato (formula di Epley) è kg × (1 + ripetizioni/30), usato al posto del kg grezzo
// per pesare la serie in base alla forza che esprime invece che al solo peso sollevato.
// Unico punto di verità per questa formula lato frontend — importata ovunque serva invece di
// essere riscritta, così una modifica futura (es. cambio formula 1RM) si fa in un solo posto.
export function unRepMax(kg, ripetizioni) {
  return kg * (1 + ripetizioni / 30);
}

export function punteggioSerie(ripetizioni, kg, rpe) {
  return ripetizioni * unRepMax(kg, ripetizioni) * (rpe / 10);
}
