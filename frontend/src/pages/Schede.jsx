import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export default function Schede() {
  const [lista, setLista] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  async function ricarica() {
    const s = await api.get('/schede');
    setLista(s);
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
  }, []);

  async function elimina(id) {
    await api.del(`/schede/${id}`);
    await ricarica();
  }

  if (caricamento) return <div className="loading-schermo">Caricamento…</div>;

  return (
    <div className="pagina">
      <div className="pagina__header">
        <h1>Schede</h1>
        <Link to="/schede/nuova" className="btn btn--primario">
          + Nuova
        </Link>
      </div>
      <p className="testo-secondario">
        Una scheda è un gruppo ordinato di esercizi da riusare come base per un allenamento.
      </p>

      <ul className="lista-allenamenti">
        {lista.map((s) => (
          <li key={s.id} className="pannello lista-allenamenti__riga">
            <Link to={`/schede/${s.id}/modifica`} className="lista-allenamenti__link">
              <strong>{s.nome}</strong>
              <span className="testo-secondario">{s.numero_esercizi} esercizi</span>
            </Link>
            <button className="btn btn--testo" onClick={() => elimina(s.id)}>
              Elimina
            </button>
          </li>
        ))}
        {lista.length === 0 && <p className="testo-secondario">Nessuna scheda ancora.</p>}
      </ul>
    </div>
  );
}
