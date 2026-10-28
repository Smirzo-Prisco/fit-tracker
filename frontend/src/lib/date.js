// Converte una data "YYYY-MM-DD" (come restituita dal DB o dagli input HTML) nel formato italiano gg/mm/aaaa.
export function formattaData(iso) {
  if (!iso) return '';
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

// Converte un DATETIME del DB ("YYYY-MM-DD HH:mm:ss") in "gg/mm/aaaa, hh:mm" — lo spazio
// al posto della "T" fa fallire il parsing su Safari/iOS (vedi fix NaN in altre pagine),
// da qui la sostituzione prima di new Date().
export function formattaDataOra(datetime) {
  if (!datetime) return '';
  const d = new Date(datetime.replace(' ', 'T'));
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Data (oggetto Date) in "gg/mm", senza anno — per etichette compatte su assi di grafici.
export function formattaDataBreve(date) {
  const giorno = String(date.getDate()).padStart(2, '0');
  const mese = String(date.getMonth() + 1).padStart(2, '0');
  return `${giorno}/${mese}`;
}

// Lunedì (ISO "YYYY-MM-DD") della settimana a cui appartiene una data — stessa convenzione
// lun-dom usata per settimana_inizio nel backend (WEEKDAY: 0=lun...6=dom). Usata per
// raggruppare per settimana elenchi già ordinati per data, lato client.
export function inizioSettimanaDi(isoData) {
  const d = new Date(`${isoData}T00:00:00`);
  const giorno = (d.getDay() + 6) % 7; // lunedì = 0
  d.setDate(d.getDate() - giorno);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Intervallo di una settimana lun-dom in "gg/mm-gg/mm" (senza anno) — usata per
// raggruppare l'elenco allenamenti per settimana. Riceve il lunedì "YYYY-MM-DD".
export function formattaIntervalloSettimana(isoInizio) {
  if (!isoInizio) return '';
  const inizio = new Date(`${isoInizio}T00:00:00`);
  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 6);
  const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${fmt(inizio)}-${fmt(fine)}`;
}
