import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function NuovaScheda() {
  const { id } = useParams();
  const navigate = useNavigate();
  const inModifica = Boolean(id);

  const [catalogo, setCatalogo] = useState(null);
  const [nome, setNome] = useState('');
  const [esercizi, setEsercizi] = useState([]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    api.get('/esercizi').then(setCatalogo);
  }, []);

  useEffect(() => {
    if (!inModifica) return;
    api.get(`/schede/${id}`).then((s) => {
      setNome(s.nome);
      setEsercizi(s.esercizi.map((e) => e.esercizio_id));
    });
  }, [id, inModifica]);

  function aggiungiEsercizio(esercizioId) {
    if (!esercizioId) return;
    setEsercizi((prev) => [...prev, esercizioId]);
  }

  function rimuoviEsercizio(indice) {
    setEsercizi((prev) => prev.filter((_, i) => i !== indice));
  }

  function sposta(indice, direzione) {
    setEsercizi((prev) => {
      const nuovo = [...prev];
      const altro = indice + direzione;
      if (altro < 0 || altro >= nuovo.length) return prev;
      [nuovo[indice], nuovo[altro]] = [nuovo[altro], nuovo[indice]];
      return nuovo;
    });
  }

  async function invia(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    const payload = { nome, esercizi: esercizi.map((esercizio_id) => ({ esercizio_id })) };
    try {
      if (inModifica) {
        await api.put(`/schede/${id}`, payload);
      } else {
        await api.post('/schede', payload);
      }
      navigate('/schede');
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  if (catalogo === null) return <div className="loading-schermo">Caricamento…</div>;

  if (catalogo.length === 0) {
    return (
      <div className="pagina">
        <h1>{inModifica ? 'Modifica scheda' : 'Nuova scheda'}</h1>
        <p className="testo-secondario">Crea prima almeno un esercizio nel catalogo.</p>
        <Link to="/esercizi" className="btn btn--primario">
          Vai a Esercizi
        </Link>
      </div>
    );
  }

  return (
    <div className="pagina">
      <h1>{inModifica ? 'Modifica scheda' : 'Nuova scheda'}</h1>

      <form onSubmit={invia} className="form">
        <label>
          Nome scheda
          <input
            placeholder="es. Scheda A - Petto/Tricipiti"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>

        <h2>Esercizi in ordine</h2>
        <div className="lista-scheda-esercizi">
          {esercizi.map((esercizioId, i) => {
            const es = catalogo.find((e) => String(e.id) === String(esercizioId));
            return (
              <div key={i} className="riga-scheda-esercizio">
                <span className="riga-scheda-esercizio__ordine">{i + 1}</span>
                {es?.immagine_url && <img src={es.immagine_url} alt="" />}
                <span className="riga-scheda-esercizio__nome">{es?.nome || '—'}</span>
                <div className="riga-scheda-esercizio__azioni">
                  <button type="button" onClick={() => sposta(i, -1)} disabled={i === 0} aria-label="Sposta su">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => sposta(i, 1)}
                    disabled={i === esercizi.length - 1}
                    aria-label="Sposta giù"
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => rimuoviEsercizio(i)} aria-label="Rimuovi">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          {esercizi.length === 0 && <p className="testo-secondario">Nessun esercizio aggiunto ancora.</p>}
        </div>

        <select value="" onChange={(e) => aggiungiEsercizio(e.target.value)}>
          <option value="" disabled>
            + Aggiungi esercizio alla scheda…
          </option>
          {catalogo.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>

        {errore && <p className="messaggio-errore">{errore}</p>}
        <button type="submit" className="btn btn--primario" disabled={salvataggio || esercizi.length === 0}>
          {salvataggio ? 'Salvataggio…' : 'Salva scheda'}
        </button>
      </form>
    </div>
  );
}
