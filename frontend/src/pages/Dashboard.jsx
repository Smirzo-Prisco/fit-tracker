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

// Soglie per classificare l'andamento settimana-su-settimana del punteggio di carico
// (Serie × Ripetizioni × Kg × RPE/10). Sotto il 5% di variazione si considera "stabile":
// lì la differenza la fa l'RPE medio (stesso lavoro percepito come più leggero = si è
// diventati più forti, anche se il punteggio non è salito).
const SOGLIA_CRESCITA = 5;
const SOGLIA_CALO = -15;
const SOGLIA_RPE_MINORE = -0.3;

const VOCI_LEGENDA = [
  {
    chiave: 'crescita',
    icona: '📈',
    titolo: 'In crescita costante',
    significato: 'Progressione lineare, stai migliorando la forza o la resistenza.',
    azione: 'Continua così, stai applicando il sovraccarico progressivo.',
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
    azione: 'Programma una settimana di scarico (riduci il punteggio del 30-40%).',
  },
];

// Confronta l'ultima settimana con dati e la precedente. Richiede almeno due settimane
// valide (punteggio_totale non nullo, cioè con RPE registrato su almeno una serie).
function classificaAndamento(settimane) {
  const valide = settimane.filter((s) => s.punteggio_totale != null);
  if (valide.length < 2) return null;
  const attuale = valide[valide.length - 1];
  const precedente = valide[valide.length - 2];

  const deltaPercento = ((attuale.punteggio_totale - precedente.punteggio_totale) / precedente.punteggio_totale) * 100;
  const deltaRpe = attuale.rpe_medio - precedente.rpe_medio;

  let chiave;
  if (deltaPercento <= SOGLIA_CALO) chiave = 'calo';
  else if (deltaPercento >= SOGLIA_CRESCITA) chiave = 'crescita';
  else if (deltaRpe <= SOGLIA_RPE_MINORE) chiave = 'rpe_minore';
  else chiave = 'stabile';

  return { ...VOCI_LEGENDA.find((v) => v.chiave === chiave), deltaPercento, deltaRpe };
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

  const datiCarico = useMemo(
    () => andamento.map((s) => ({ settimana: formattaData(s.settimana_inizio), punteggio: s.punteggio_totale })),
    [andamento]
  );
  const classificazione = useMemo(() => classificaAndamento(andamento), [andamento]);

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
      <h1>Ciao 👋</h1>

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
            {datiCarico.length > 1 && (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={datiCarico}>
                  <XAxis dataKey="settimana" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={44} />
                  <Tooltip />
                  <Line type="monotone" dataKey="punteggio" stroke="#e5484d" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}

            {classificazione ? (
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
                Registra l'RPE per almeno due settimane di allenamenti per vedere l'andamento.
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
