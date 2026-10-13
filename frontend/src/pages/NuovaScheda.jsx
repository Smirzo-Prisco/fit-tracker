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
      setEsercizi(
        s.esercizi.map((e) => ({
          esercizio_id: e.esercizio_id,
          serie_consigliate: e.serie_consigliate ?? '',
          ripetizioni_consigliate: e.ripetizioni_consigliate ?? '',
        }))
      );
    });
  }, [id, inModifica]);

  function aggiungiEsercizio(esercizioId) {
    if (!esercizioId) return;
    setEsercizi((prev) => [...prev, { esercizio_id: esercizioId, serie_consigliate: '', ripetizioni_consigliate: '' }]);
  }

  function aggiornaObiettivo(indice, campo, valore) {
    setEsercizi((prev) => prev.map((e, i) => (i === indice ? { ...e, [campo]: valore } : e)));
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
    const payload = {
      nome,
      esercizi: esercizi.map((e) => ({
        esercizio_id: e.esercizio_id,
        serie_consigliate: e.serie_consigliate || null,
        ripetizioni_consigliate: e.ripetizioni_consigliate || null,
      })),
    };
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
        <p className="testo-secondario">
          Serie e ripetizioni sono solo un obiettivo di riferimento per quando farai l'allenamento da questa
          scheda — non influenzano il punteggio di carico.
        </p>
        <div className="lista-scheda-esercizi">
          {esercizi.map((riga, i) => {
            const es = catalogo.find((e) => String(e.id) === String(riga.esercizio_id));
            return (
              <div key={i} className="riga-scheda-esercizio">
                <span className="riga-scheda-esercizio__ordine">{i + 1}</span>
                {es?.immagine_url && <img src={es.immagine_url} alt="" />}
                <span className="riga-scheda-esercizio__nome">{es?.nome || '—'}</span>
                <div className="riga-scheda-esercizio__riga2">
                  <input
                    type="number"
                    min="1"
                    placeholder="Serie"
                    className="riga-scheda-esercizio__obiettivo"
                    value={riga.serie_consigliate}
                    onChange={(e) => aggiornaObiettivo(i, 'serie_consigliate', e.target.value)}
                    aria-label="Serie consigliate"
                  />
                  <span className="riga-scheda-esercizio__per">×</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Rip."
                    className="riga-scheda-esercizio__obiettivo"
                    value={riga.ripetizioni_consigliate}
                    onChange={(e) => aggiornaObiettivo(i, 'ripetizioni_consigliate', e.target.value)}
                    aria-label="Ripetizioni consigliate"
                  />
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
