// Converte una data "YYYY-MM-DD" (come restituita dal DB o dagli input HTML) nel formato italiano gg/mm/aaaa.
export function formattaData(iso) {
  if (!iso) return '';
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

// Formatta l'intervallo lun-dom di una settimana a partire dal lunedì "YYYY-MM-DD" (es.
// "05–11/10"), per le etichette del grafico di andamento settimanale — mostrare solo la
// data di inizio lasciava intendere un singolo giorno invece di un'intera settimana.
export function formattaSettimana(isoInizio) {
  if (!isoInizio) return '';
  const inizio = new Date(`${isoInizio}T00:00:00`);
  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 6);
  const giornoInizio = String(inizio.getDate()).padStart(2, '0');
  const giornoFine = String(fine.getDate()).padStart(2, '0');
  const meseInizio = String(inizio.getMonth() + 1).padStart(2, '0');
  const meseFine = String(fine.getMonth() + 1).padStart(2, '0');
  if (meseInizio === meseFine) {
    return `${giornoInizio}–${giornoFine}/${meseFine}`;
  }
  return `${giornoInizio}/${meseInizio}–${giornoFine}/${meseFine}`;
}
