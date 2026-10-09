// Converte una data "YYYY-MM-DD" (come restituita dal DB o dagli input HTML) nel formato italiano gg/mm/aaaa.
export function formattaData(iso) {
  if (!iso) return '';
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

// Etichetta di una settimana lun-dom per il grafico di andamento settimanale: la domenica
// (ultimo giorno), non il lunedì di inizio — è il giorno in cui il risultato della
// settimana è completo, coerente col fatto che il punto raccoglie il totale di tutta la
// settimana. Riceve il lunedì "YYYY-MM-DD" (settimana_inizio) e restituisce gg/mm/aaaa.
export function formattaSettimana(isoInizio) {
  if (!isoInizio) return '';
  const fine = new Date(`${isoInizio}T00:00:00`);
  fine.setDate(fine.getDate() + 6);
  const giorno = String(fine.getDate()).padStart(2, '0');
  const mese = String(fine.getMonth() + 1).padStart(2, '0');
  const anno = fine.getFullYear();
  return `${giorno}/${mese}/${anno}`;
}
