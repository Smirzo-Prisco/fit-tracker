import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';

function inizioSettimana() {
  const oggi = new Date();
  const giorno = (oggi.getDay() + 6) % 7; // lunedì = 0
  oggi.setDate(oggi.getDate() - giorno);
  oggi.setHours(0, 0, 0, 0);
  return oggi;
}

export default function Dashboard() {
  const [misurazioni, setMisurazioni] = useState([]);
  const [allenamenti, setAllenamenti] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    (async () => {
      const [m, a] = await Promise.all([api.get('/misurazioni'), api.get('/allenamenti')]);
      setMisurazioni(m);
      setAllenamenti(a);
      setCaricamento(false);
    })();
  }, []);

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
