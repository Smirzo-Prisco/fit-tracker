// Elenco fisso dei gruppi muscolari selezionabili per un esercizio, invece di un
// campo di testo libero — serve ad avere valori consistenti su cui poter poi
// costruire una reportistica per gruppo muscolare (GROUP BY su un set noto).
// Ricalca esattamente i valori già in uso negli esercizi esistenti: aggiungerne
// di nuovi qui non richiede migrazioni, ma va tenuto in sync con la stessa
// costante in backend/routes/esercizi.js.
export const GRUPPI_MUSCOLARI = ['Petto', 'Dorsali', 'Spalle', 'Bicipiti', 'Tricipiti', 'Gambe', 'Addominali'];

// Un colore per gruppo, per rendere il catalogo esercizi scorribile a colpo
// d'occhio (filtri e righe). I valori sono i token CSS in styles.css :root.
export const COLORE_GRUPPO = {
  Petto: 'var(--colore-gruppo-petto)',
  Dorsali: 'var(--colore-gruppo-dorsali)',
  Spalle: 'var(--colore-gruppo-spalle)',
  Bicipiti: 'var(--colore-gruppo-bicipiti)',
  Tricipiti: 'var(--colore-gruppo-tricipiti)',
  Gambe: 'var(--colore-gruppo-gambe)',
  Addominali: 'var(--colore-gruppo-addominali)',
};
