import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';
import { GRUPPI_MUSCOLARI } from '../lib/gruppiMuscolari';

function inizioSettimana() {
  const oggi = new Date();
  const giorno = (oggi.getDay() + 6) % 7; // lunedì = 0
  oggi.setDate(oggi.getDate() - giorno);
  oggi.setHours(0, 0, 0, 0);
  return oggi;
}

// Stesso lunedì di inizioSettimana(), ma come stringa "YYYY-MM-DD" per confrontarlo
// con settimana_inizio (una DATE del DB, restituita come stringa da mysql2).
function inizioSettimanaIso() {
  const d = inizioSettimana();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Soglie per classificare l'andamento settimana-su-settimana del punteggio di carico
// (Serie × Ripetizioni × Kg × RPE/10). Sotto il 5% di variazione si considera "stabile":
// lì la differenza la fa l'RPE medio (stesso lavoro percepito come più leggero = si è
// diventati più forti, anche se il punteggio non è salito).
const SOGLIA_CRESCITA = 5;
const SOGLIA_CALO = -15;
const SOGLIA_RPE_MINORE = -0.3;
// Punteggio Medio per serie (PMR = punteggio_totale / numero_set): se il punteggio totale
// cresce ma il PMR cala di oltre il 3%, la crescita viene da PIÙ serie, non da serie
// migliori — probabile "junk volume" (fatica aggiunta senza reale sovraccarico progressivo).
const SOGLIA_JUNK_VOLUME = -3;

const VOCI_LEGENDA = [
  {
    chiave: 'crescita',
    icona: '📈',
    titolo: 'In crescita costante',
    significato: 'Il punteggio sale mantenendo (o migliorando) la resa media per serie: è sovraccarico progressivo reale.',
    azione: 'Continua così, stai applicando il sovraccarico progressivo.',
  },
  {
    chiave: 'junk_volume',
    icona: '⚠️',
    titolo: 'Volume in aumento, resa per serie in calo',
    significato: 'Il punteggio totale sale, ma solo perché hai aggiunto serie: la resa media per singola serie è scesa di oltre il 3%.',
    azione:
      'Hai aumentato le serie/volume, ma la prestazione per singola serie è calata. Attento all’accumulo di fatica.',
  },
  {
    chiave: 'stabile',
    icona: '⏸️',
    titolo: 'Stabile a parità di RPE',
    significato: 'Stallo nei progressi. Il corpo si è adattato allo stimolo.',
    azione: 'Varia una variabile (es. aumenta il carico del 2-5% o aggiungi 1 serie).',
  },
  {
    chiave: 'rpe_minore',
    icona: '💡',
    titolo: 'Stabile ma con RPE minore',
    significato: 'Stai diventando più forte! Lo stesso lavoro ti costa meno fatica.',
    azione: 'Ottimo progresso invisibile. È il momento di incrementare i kg.',
  },
  {
    chiave: 'calo',
    icona: '📉',
    titolo: 'In calo drastico',
    significato: 'Stanchezza accumulata o recupero insufficiente.',
    azione:
      'Se prosegue da 2 settimane, programma uno scarico (riduci il punteggio del 30-40%); se è la prima settimana, monitora prima di intervenire.',
  },
];

// Variazione percentuale tra due settimane consecutive (per il punteggio totale). Una
// settimana marcata come scarico (in prima o seconda posizione del confronto) non conta
// mai come calo: il calo è voluto, non un segnale da correggere — vedi PUT /andamento/scarico.
function isCaloTransizione(attuale, precedente) {
  if (!precedente || !precedente.punteggio_totale) return false;
  if (attuale.scarico || precedente.scarico) return false;
  const delta = ((attuale.punteggio_totale - precedente.punteggio_totale) / precedente.punteggio_totale) * 100;
  return delta <= SOGLIA_CALO;
}

// Confronta l'ultima settimana CONCLUSA con dati e la precedente. Richiede almeno due
// settimane valide (punteggio_totale non nullo, cioè con RPE registrato su almeno una
// serie). La settimana in corso viene esclusa dal confronto: il suo totale è per forza
// parziale (mancano ancora giorni/allenamenti), quindi sembrerebbe quasi sempre un calo
// rispetto a una settimana conclusa anche a parità di ritmo — resta visibile nel grafico,
// ma non entra nella classificazione finché non è finita.
function classificaAndamento(settimane, settimanaCorrenteIso) {
  const valide = settimane.filter((s) => s.punteggio_totale != null);
  const concluse = valide.filter((s) => s.settimana_inizio !== settimanaCorrenteIso);
  if (concluse.length < 2) {
    const inCorso = valide.some((s) => s.settimana_inizio === settimanaCorrenteIso);
    return inCorso ? { inCorso: true } : null;
  }
  const attuale = concluse[concluse.length - 1];
  const precedente = concluse[concluse.length - 2];
  const precPrecedente = concluse.length >= 3 ? concluse[concluse.length - 3] : null;

  const deltaPercento = ((attuale.punteggio_totale - precedente.punteggio_totale) / precedente.punteggio_totale) * 100;
  const deltaRpe = attuale.rpe_medio - precedente.rpe_medio;

  // PMR (punteggio medio per serie): quanto rende, in media, ogni singola serie della
  // settimana. Confrontato tra le due settimane distingue "più forte" da "più stanco".
  const pmrAttuale = attuale.numero_set > 0 ? attuale.punteggio_totale / attuale.numero_set : null;
  const pmrPrecedente = precedente.numero_set > 0 ? precedente.punteggio_totale / precedente.numero_set : null;
  const deltaPmrPercento =
    pmrAttuale != null && pmrPrecedente != null && pmrPrecedente !== 0
      ? ((pmrAttuale - pmrPrecedente) / pmrPrecedente) * 100
      : null;

  let chiave;
  let azione; // Se valorizzata, sovrascrive l'azione statica di VOCI_LEGENDA (solo per "calo").

  if (isCaloTransizione(attuale, precedente)) {
    chiave = 'calo';
    // La settimana scorsa era di scarico apposta: nessun altro scarico da consigliare ora.
    const scaricoSettimanaScorsa = precedente.scarico === true;
    // Due cali consecutivi (questa settimana rispetto alla scorsa, E la scorsa rispetto
    // a quella prima ancora): solo allora si consiglia davvero uno scarico programmato.
    const caloDaDueSettimane = !scaricoSettimanaScorsa && isCaloTransizione(precedente, precPrecedente);
    if (scaricoSettimanaScorsa) {
      azione = 'Hai già fatto scarico la settimana scorsa: è normale un assestamento, nessun altro scarico necessario ora.';
    } else if (caloDaDueSettimane) {
      azione = 'Il calo prosegue da almeno due settimane: programma una settimana di scarico (riduci il punteggio del 30-40%).';
    } else {
      azione = 'Potrebbe essere un calo occasionale (riposo, stress, alimentazione): monitora la prossima settimana prima di intervenire.';
    }
  } else if (deltaPercento >= SOGLIA_CRESCITA) {
    chiave = deltaPmrPercento != null && deltaPmrPercento < SOGLIA_JUNK_VOLUME ? 'junk_volume' : 'crescita';
  } else if (deltaRpe <= SOGLIA_RPE_MINORE) {
    chiave = 'rpe_minore';
  } else {
    chiave = 'stabile';
  }

  const voce = VOCI_LEGENDA.find((v) => v.chiave === chiave);
  return { ...voce, azione: azione ?? voce.azione, deltaPercento, deltaRpe, deltaPmrPercento };
}

export default function Dashboard() {
  const [misurazioni, setMisurazioni] = useState([]);
  const [allenamenti, setAllenamenti] = useState([]);
  const [andamento, setAndamento] = useState([]);
  const [gruppoSelezionato, setGruppoSelezionato] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [caricamentoAndamento, setCaricamentoAndamento] = useState(false);

  useEffect(() => {
    (async () => {
      const [m, a] = await Promise.all([api.get('/misurazioni'), api.get('/allenamenti')]);
      setMisurazioni(m);
      setAllenamenti(a);
      setCaricamento(false);
    })();
  }, []);

  // Separato dal caricamento iniziale: cambiare gruppo muscolare rifiltra solo
  // questo pannello, senza ricaricare peso/allenamenti.
  useEffect(() => {
    setCaricamentoAndamento(true);
    const query = gruppoSelezionato ? `&gruppo_muscolare=${encodeURIComponent(gruppoSelezionato)}` : '';
    api
      .get(`/allenamenti/andamento?settimane=12${query}`)
      .then(setAndamento)
      .finally(() => setCaricamentoAndamento(false));
  }, [gruppoSelezionato]);

  // Per la settimana in corso usa la proiezione (reale finora + stima dei giorni
  // mancanti sullo stesso giorno della settimana) invece del solo totale parziale, che
  // sembrerebbe sempre un calo rispetto a una settimana conclusa. Il punto proiettato va
  // su una serie separata (punteggioProiezione) disegnata tratteggiata, per non far
  // sembrare una stima un dato reale già confermato; punteggioProiezione riprende anche
  // il valore del punto precedente così la linea tratteggiata si aggancia a quella piena
  // invece di partire staccata.
  const datiCarico = useMemo(() => {
    const dati = andamento.map((s, i, arr) => {
      const inProiezione = i === arr.length - 1 && s.punteggio_proiettato != null;
      return {
        settimana: formattaData(s.settimana_inizio),
        punteggio: inProiezione ? null : s.punteggio_totale,
        punteggioProiezione: inProiezione ? s.punteggio_proiettato : null,
      };
    });
    if (dati.length >= 2 && dati[dati.length - 1].punteggioProiezione != null) {
      dati[dati.length - 2].punteggioProiezione = dati[dati.length - 2].punteggio;
    }
    return dati;
  }, [andamento]);
  const inProiezione = andamento.length > 0 && andamento[andamento.length - 1].punteggio_proiettato != null;
  const classificazione = useMemo(() => classificaAndamento(andamento, inizioSettimanaIso()), [andamento]);

  // Ultima settimana con dati: è l'unica su cui ha senso proporre il toggle scarico
  // (contrassegnare settimane passate non serve, la classificazione guarda solo le ultime due).
  const ultimaSettimana = andamento[andamento.length - 1];

  async function toggleScarico(settimanaInizio, scarico) {
    await api.put('/allenamenti/andamento/scarico', { settimana_inizio: settimanaInizio, scarico });
    setAndamento((prev) => prev.map((s) => (s.settimana_inizio === settimanaInizio ? { ...s, scarico } : s)));
  }

  const datiPeso = useMemo(
    () =>
      [...misurazioni]
        .filter((m) => m.peso_kg != null)
        .reverse()
        .map((m) => ({ data: formattaData(m.data), peso: Number(m.peso_kg) })),
    [misurazioni]
  );

  const ultimaMisurazione = misurazioni[0];
  const allenamentiSettimana = useMemo(() => {
    const inizio = inizioSettimana();
    return allenamenti.filter((a) => new Date(a.data) >= inizio);
  }, [allenamenti]);

  if (caricamento) return <div className="loading-schermo">Caricamento…</div>;

  return (
    <div className="pagina">
      <div className="pagina__header">
        <h1>Ciao 👋</h1>
        <Link to="/profilo" className="pulsante-profilo" aria-label="Profilo">
          👤
        </Link>
      </div>

      <div className="card-grid">
        <div className="card">
          <span className="card__etichetta">Peso attuale</span>
          <span className="card__valore">
            {ultimaMisurazione?.peso_kg ? `${ultimaMisurazione.peso_kg} kg` : '—'}
          </span>
          <span className="card__sotto">
            {ultimaMisurazione ? `aggiornato il ${formattaData(ultimaMisurazione.data)}` : 'nessuna misurazione'}
          </span>
        </div>
        <div className="card">
          <span className="card__etichetta">Allenamenti questa settimana</span>
          <span className="card__valore">{allenamentiSettimana.length}</span>
        </div>
      </div>

      {datiPeso.length > 1 && (
        <div className="pannello">
          <h2>Andamento peso</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={datiPeso}>
              <XAxis dataKey="data" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="peso" stroke="#1e6feb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="pannello">
        <div className="pannello__header">
          <h2>Monitoraggio carico settimanale</h2>
          <select value={gruppoSelezionato} onChange={(e) => setGruppoSelezionato(e.target.value)}>
            <option value="">Tutti i gruppi</option>
            {GRUPPI_MUSCOLARI.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <p className="testo-secondario">
          Punteggio di carico = Serie × Ripetizioni × Kg × (RPE/10), sommato su tutte le serie della settimana.
        </p>

        {caricamentoAndamento ? (
          <p className="testo-secondario">Caricamento…</p>
        ) : datiCarico.length === 0 ? (
          <p className="testo-secondario">
            {gruppoSelezionato
              ? `Nessuna serie con RPE registrato per ${gruppoSelezionato}.`
              : 'Registra ripetizioni, kg e RPE nelle serie per vedere qui il carico settimanale.'}
          </p>
        ) : (
          <>
            {ultimaSettimana && (
              <div className="carico-meta">
                <span className="testo-secondario">🔢 {ultimaSettimana.numero_set} serie questa settimana</span>
                <label className="toggle-scarico">
                  <input
                    type="checkbox"
                    checked={ultimaSettimana.scarico}
                    onChange={(e) => toggleScarico(ultimaSettimana.settimana_inizio, e.target.checked)}
                  />
                  Settimana di scarico
                </label>
              </div>
            )}

            {datiCarico.length > 1 && (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={datiCarico}>
                    <XAxis dataKey="settimana" tick={{ fontSize: 11 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={44} />
                    <Tooltip />
                    <Line type="monotone" dataKey="punteggio" name="Punteggio" stroke="#e5484d" strokeWidth={2} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="punteggioProiezione"
                      name="Proiezione"
                      stroke="#e5484d"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
                {inProiezione && (
                  <p className="testo-secondario">
                    🔮 L'ultimo punto (tratteggiato) è una proiezione: al reale di questa settimana somma, per i
                    giorni non ancora trascorsi, il tuo ultimo risultato in quello stesso giorno della settimana.
                  </p>
                )}
              </>
            )}

            {classificazione?.inCorso ? (
              <div className="carico-classificazione">
                <span className="carico-classificazione__icona">⏳</span>
                <div>
                  <strong>Settimana in corso</strong>
                  <p className="testo-secondario">
                    Il grafico mostra già una proiezione, ma la classificazione dell'andamento (in crescita, in calo,
                    stabile…) userà i dati reali: sarà disponibile a settimana conclusa.
                  </p>
                </div>
              </div>
            ) : classificazione ? (
              <div className="carico-classificazione">
                <span className="carico-classificazione__icona">{classificazione.icona}</span>
                <div>
                  <strong>{classificazione.titolo}</strong>
                  <p className="testo-secondario">{classificazione.significato}</p>
                  <p className="testo-secondario">💪 {classificazione.azione}</p>
                </div>
              </div>
            ) : (
              <p className="testo-secondario">
                Registra l'RPE per almeno due settimane concluse di allenamenti per vedere l'andamento.
              </p>
            )}

            <details className="carico-legenda">
              <summary>Come interpretare l'andamento</summary>
              <table className="tabella-legenda">
                <thead>
                  <tr>
                    <th>Andamento</th>
                    <th>Cosa significa</th>
                    <th>Azione consigliata</th>
                  </tr>
                </thead>
                <tbody>
                  {VOCI_LEGENDA.map((v) => (
                    <tr key={v.chiave}>
                      <td>
                        {v.icona} {v.titolo}
                      </td>
                      <td>{v.significato}</td>
                      <td>{v.azione}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>

      <div className="azioni-rapide">
        <Link to="/misurazioni" className="btn btn--primario">
          + Nuova misurazione
        </Link>
        <Link to="/allenamenti/nuovo" className="btn btn--secondario">
          + Nuovo allenamento
        </Link>
      </div>
    </div>
  );
}
