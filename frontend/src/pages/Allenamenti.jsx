import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';

export default function Allenamenti() {
  const [lista, setLista] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  async function ricarica() {
    const a = await api.get('/allenamenti');
    setLista(a);
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
  }, []);

  async function elimina(id) {
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
      <Link to="/schede" className="testo-secondario link-schede">
        📋 Le mie schede
      </Link>

      <ul className="lista-allenamenti">
        {lista.map((a) => (
          <li key={a.id} className="pannello lista-allenamenti__riga">
            <Link to={`/allenamenti/${a.id}/modifica`} className="lista-allenamenti__link">
              <strong>{formattaData(a.data)}</strong>
              <span className="testo-secondario">
                {a.numero_esercizi} esercizi{a.durata_min ? ` · ${a.durata_min} min` : ''}
              </span>
              {a.note && <p className="testo-secondario">{a.note}</p>}
            </Link>
            <button className="btn btn--testo" onClick={() => elimina(a.id)}>
              Elimina
            </button>
          </li>
        ))}
        {lista.length === 0 && <p className="testo-secondario">Nessun allenamento registrato ancora.</p>}
      </ul>
    </div>
  );
}
