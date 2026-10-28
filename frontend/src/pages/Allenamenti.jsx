import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formattaData, formattaIntervalloSettimana, inizioSettimanaDi } from '../lib/date';
import { formattaPunteggio, formattaDelta } from '../lib/punteggioCarico';

export default function Allenamenti() {
  const [lista, setLista] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  // La lista arriva già ordinata per data DESC dal backend: raggruppare preservando
  // l'ordine basta a tenere ogni settimana compatta, senza riordinare nulla.
  const gruppiSettimana = useMemo(() => {
    const gruppi = [];
    const perSettimana = new Map();
    for (const a of lista) {
      const settimanaInizio = inizioSettimanaDi(a.data);
      let gruppo = perSettimana.get(settimanaInizio);
      if (!gruppo) {
        gruppo = { settimanaInizio, voci: [] };
        perSettimana.set(settimanaInizio, gruppo);
        gruppi.push(gruppo);
      }
      gruppo.voci.push(a);
    }
    return gruppi;
  }, [lista]);

  async function ricarica() {
    const a = await api.get('/allenamenti');
    setLista(a);
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
  }, []);

  async function elimina(id) {
    if (!window.confirm('Eliminare questo allenamento? Non è reversibile.')) return;
    await api.del(`/allenamenti/${id}`);
    await ricarica();
  }

  if (caricamento) return <div className="loading-schermo">Caricamento…</div>;

  return (
    <div className="pagina">
      <div className="pagina__header">
        <h1>Allenamenti</h1>
        <Link to="/allenamenti/nuovo" className="btn btn--primario">
          + Nuovo
        </Link>
      </div>

      {gruppiSettimana.map((gruppo) => (
        <div key={gruppo.settimanaInizio} className="gruppo-settimana">
          <h2 className="gruppo-settimana__titolo">{formattaIntervalloSettimana(gruppo.settimanaInizio)}</h2>
          <ul className="lista-allenamenti">
            {gruppo.voci.map((a) => (
              <li key={a.id} className="pannello lista-allenamenti__riga">
                <Link to={`/allenamenti/${a.id}/modifica`} className="lista-allenamenti__link">
                  <span className="lista-allenamenti__data-riga">
                    <strong>{formattaData(a.data)}</strong>
                    {a.scheda_nome && <span className="badge-scheda">{a.scheda_nome}</span>}
                  </span>
                  <span className="testo-secondario">
                    {a.numero_esercizi} esercizi{a.durata_min ? ` · ${a.durata_min} min` : ''}
                    {a.punteggio_reale != null && ` · 🏋️ ${formattaPunteggio(a.punteggio_reale)}`}
                    {a.punteggio_reale == null &&
                      a.punteggio_previsto != null &&
                      ` · 🏋️ ${formattaPunteggio(a.punteggio_previsto)} (previsto)`}
                    {a.delta_precedente != null && ` (${formattaDelta(a.delta_precedente)})`}
                  </span>
                  {a.note && <p className="testo-secondario">{a.note}</p>}
                </Link>
                <button className="btn btn--testo" onClick={() => elimina(a.id)}>
                  Elimina
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {lista.length === 0 && <p className="testo-secondario">Nessun allenamento registrato ancora.</p>}
    </div>
  );
}
