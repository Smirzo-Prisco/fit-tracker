// Converte una data "YYYY-MM-DD" (come restituita dal DB o dagli input HTML) nel formato italiano gg/mm/aaaa.
export function formattaData(iso) {
  if (!iso) return '';
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}
