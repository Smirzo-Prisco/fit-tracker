const pool = require('../db');

// Punteggio di carico (Training Load Score) di una serie: ripetizioni × (kg / 1RM di
// riferimento) × (RPE/10) — pesa la serie in base a quanto è vicina al meglio recente
// dell'utente su quell'esercizio, non al peso assoluto sollevato. Il denominatore (1RM di
// riferimento) è il migliore 1RM stimato con la formula di Epley (kg × (1 + ripetizioni/30))
// nelle ultime 4 settimane; se l'esercizio non è stato allenato di recente si usa il
// migliore di sempre, così un esercizio ripreso dopo una pausa non perde punteggio solo per
// mancanza di un riferimento recente (vedi caricaRiferimenti1Rm sotto).
// Unico punto di verità per questa formula lato backend — richiamata da tutte le route che
// calcolano un punteggio, sia riga per riga in JS sia (tramite SQL_PUNTEGGIO_SERIE /
// sqlJoinRiferimento1Rm) nelle query aggregate.
function punteggioSerie(s, riferimento1Rm) {
  if (s.ripetizioni == null || s.peso_kg == null || s.rpe == null) return null;
  if (!riferimento1Rm) return null;
  return Number(s.ripetizioni) * (Number(s.peso_kg) / riferimento1Rm) * (Number(s.rpe) / 10);
}

// Stessa formula in SQL, per le query aggregate che sommano su molte serie direttamente nel
// database invece che riga per riga in JS. Richiede che la query includa anche
// sqlJoinRiferimento1Rm(...) per rendere disponibile rif.riferimento_1rm.
const SQL_PUNTEGGIO_SERIE = 's.ripetizioni * (s.peso_kg / rif.riferimento_1rm) * (s.rpe / 10)';

// JOIN che calcola, per ogni esercizio, il punteggio di riferimento (1RM stimato più alto)
// da usare come denominatore: il migliore delle ultime 4 settimane, o il migliore di sempre
// come fallback. colonnaEsercizioId è il riferimento SQL alla colonna esercizio_id già
// disponibile nella query esterna (es. 'e.id' o 'ae.esercizio_id').
function sqlJoinRiferimento1Rm(colonnaEsercizioId) {
  return `
    LEFT JOIN (
      SELECT ae_rif.esercizio_id,
             COALESCE(
               MAX(CASE WHEN a_rif.data >= CURDATE() - INTERVAL 4 WEEK
                        THEN s_rif.peso_kg * (1 + s_rif.ripetizioni / 30) END),
               MAX(s_rif.peso_kg * (1 + s_rif.ripetizioni / 30))
             ) AS riferimento_1rm
      FROM serie s_rif
      JOIN allenamento_esercizi ae_rif ON ae_rif.id = s_rif.allenamento_esercizio_id
      JOIN allenamenti a_rif ON a_rif.id = ae_rif.allenamento_id
      WHERE a_rif.utente_id = ? AND s_rif.ripetizioni IS NOT NULL AND s_rif.peso_kg IS NOT NULL
      GROUP BY ae_rif.esercizio_id
    ) rif ON rif.esercizio_id = ${colonnaEsercizioId}
  `;
}

// Stessa logica di sqlJoinRiferimento1Rm, ma come query diretta per un uso lato JS (righe
// singole: dettaglio allenamento, salvataggio di una serie, anteprima in Esercizi/Nuovo
// allenamento) invece che come JOIN dentro un'altra query aggregata.
async function caricaRiferimenti1Rm(utenteId, esercizioIds) {
  const idUnici = [...new Set(esercizioIds)].filter((id) => id != null);
  if (idUnici.length === 0) return {};
  const [rows] = await pool.query(
    `SELECT ae.esercizio_id,
            COALESCE(
              MAX(CASE WHEN a.data >= CURDATE() - INTERVAL 4 WEEK
                       THEN s.peso_kg * (1 + s.ripetizioni / 30) END),
              MAX(s.peso_kg * (1 + s.ripetizioni / 30))
            ) AS riferimento_1rm
     FROM serie s
     JOIN allenamento_esercizi ae ON ae.id = s.allenamento_esercizio_id
     JOIN allenamenti a ON a.id = ae.allenamento_id
     WHERE a.utente_id = ? AND ae.esercizio_id IN (?)
       AND s.ripetizioni IS NOT NULL AND s.peso_kg IS NOT NULL
     GROUP BY ae.esercizio_id`,
    [utenteId, idUnici]
  );
  const mappa = {};
  for (const r of rows) mappa[r.esercizio_id] = Number(r.riferimento_1rm);
  return mappa;
}

module.exports = { punteggioSerie, SQL_PUNTEGGIO_SERIE, sqlJoinRiferimento1Rm, caricaRiferimenti1Rm };
