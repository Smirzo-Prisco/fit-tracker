// Normalizza un nome esercizio per il confronto: minuscolo, senza accenti,
// spazi multipli collassati — così "Chest Press", "chest  press" e "chèst press"
// vengono trattati come lo stesso nome.
function normalizza(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distanza di Levenshtein (numero minimo di inserimenti/cancellazioni/sostituzioni
// per trasformare a in b) — usata per catturare refusi tipo "Ches press".
function distanza(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const riga = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let precedente = riga[0];
    riga[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = riga[j];
      riga[j] = a[i - 1] === b[j - 1] ? precedente : 1 + Math.min(precedente, riga[j], riga[j - 1]);
      precedente = temp;
    }
  }
  return riga[n];
}

// Trova, nel catalogo, l'esercizio più simile al nome che si sta digitando —
// esatto (a meno di maiuscole/accenti/spazi), uno "dentro" l'altro (es. "Curl
// bicipiti" dentro "Curl bicipiti manubrio"), o entro una piccola distanza di
// editing relativa alla lunghezza. idEscluso esclude l'esercizio in modifica
// da se stesso. Nomi troppo corti (<3 caratteri utili) non vengono controllati:
// darebbero troppi falsi positivi.
export function trovaEsercizioSimile(nomeDigitato, catalogo, idEscluso = null) {
  const normalizzato = normalizza(nomeDigitato);
  if (normalizzato.length < 3) return null;

  let migliore = null;
  let miglioreScore = Infinity;

  for (const esercizio of catalogo) {
    if (esercizio.id === idEscluso) continue;

    const altro = normalizza(esercizio.nome);
    if (altro === normalizzato) return { esercizio, esatto: true };

    const contenuto = altro.includes(normalizzato) || normalizzato.includes(altro);
    const dist = distanza(normalizzato, altro);
    const soglia = Math.max(2, Math.floor(Math.max(normalizzato.length, altro.length) * 0.2));

    if (contenuto || dist <= soglia) {
      const score = contenuto ? dist * 0.5 : dist; // i nomi "contenuti" pesano meno
      if (score < miglioreScore) {
        miglioreScore = score;
        migliore = { esercizio, esatto: false };
      }
    }
  }

  return migliore;
}
