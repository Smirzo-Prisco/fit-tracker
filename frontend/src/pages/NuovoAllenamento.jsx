import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import RigaEsercizio from '../components/RigaEsercizio.jsx';

const RIGA_VUOTA = () => ({ esercizio_id: '', serie: [{ ripetizioni: '', peso_kg: '' }] });

export default function NuovoAllenamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const inModifica = Boolean(id);

  const [catalogo, setCatalogo] = useState(null);
  const [schede, setSchede] = useState([]);
  const [schedaId, setSchedaId] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [durataMin, setDurataMin] = useState('');
  const [note, setNote] = useState('');
  const [esercizi, setEsercizi] = useState([RIGA_VUOTA()]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    api.get('/esercizi').then(setCatalogo);
    api.get('/schede').then(setSchede);
  }, []);

  useEffect(() => {
    if (!inModifica) return;
    (async () => {
      const a = await api.get(`/allenamenti/${id}`);
      setData(a.data);
      setDurataMin(a.durata_min || '');
      setNote(a.note || '');
      setSchedaId(a.scheda_id || '');
      setEsercizi(
        a.esercizi.length
          ? a.esercizi.map((e) => ({
              esercizio_id: e.esercizio_id,
              serie: e.serie.length
                ? e.serie.map((s) => ({ ripetizioni: s.ripetizioni ?? '', peso_kg: s.peso_kg ?? '' }))
                : [{ ripetizioni: '', peso_kg: '' }],
            }))
          : [RIGA_VUOTA()]
      );
    })();
  }, [id, inModifica]);

  async function caricaDaScheda(nuovoSchedaId) {
    setSchedaId(nuovoSchedaId);
    if (!nuovoSchedaId) return;
    const scheda = await api.get(`/schede/${nuovoSchedaId}`);
    setEsercizi(
      scheda.esercizi.length
        ? scheda.esercizi.map((e) => ({ esercizio_id: e.esercizio_id, serie: [{ ripetizioni: '', peso_kg: '' }] }))
        : [RIGA_VUOTA()]
    );
  }

  function aggiornaEsercizio(indice, patch) {
    setEsercizi((prev) => prev.map((e, i) => (i === indice ? { ...e, ...patch } : e)));
  }

  function rimuoviEsercizio(indice) {
    setEsercizi((prev) => prev.filter((_, i) => i !== indice));
  }

  function aggiungiEsercizio() {
    setEsercizi((prev) => [...prev, RIGA_VUOTA()]);
  }

  async function invia(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    const payload = {
      data,
      durata_min: durataMin || null,
      note,
      scheda_id: schedaId || null,
      esercizi: esercizi
        .filter((ex) => ex.esercizio_id)
        .map((ex) => ({
          esercizio_id: ex.esercizio_id,
          serie: ex.serie
            .filter((s) => s.ripetizioni || s.peso_kg)
            .map((s) => ({ ripetizioni: s.ripetizioni || null, peso_kg: s.peso_kg || null })),
        })),
    };
    try {
      if (inModifica) {
        await api.put(`/allenamenti/${id}`, payload);
      } else {
        await api.post('/allenamenti', payload);
      }
      navigate('/allenamenti');
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  if (catalogo === null) {
    return <div className="loading-schermo">Caricamento…</div>;
  }

  if (catalogo.length === 0) {
    return (
      <div className="pagina">
        <h1>{inModifica ? 'Modifica allenamento' : 'Nuovo allenamento'}</h1>
        <p className="testo-secondario">
          Non hai ancora nessun esercizio nel catalogo. Creane almeno uno prima di comporre un allenamento.
        </p>
        <Link to="/esercizi" className="btn btn--primario">
          Vai a Esercizi
        </Link>
      </div>
    );
  }

  return (
    <div className="pagina">
      <h1>{inModifica ? 'Modifica allenamento' : 'Nuovo allenamento'}</h1>

      <form onSubmit={invia} className="form">
        {schede.length > 0 && (
          <label>
            Carica da scheda (opzionale)
            <select value={schedaId} onChange={(e) => caricaDaScheda(e.target.value)}>
              <option value="">— Nessuna —</option>
              {schede.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} ({s.numero_esercizi} esercizi)
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="griglia-campi">
          <label>
            Data
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </label>
          <label>
            Durata (min)
            <input type="number" value={durataMin} onChange={(e) => setDurataMin(e.target.value)} />
          </label>
        </div>
        <label>
          Note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </label>

        <h2>Esercizi</h2>
        <div className="lista-righe-esercizio">
          {esercizi.map((ex, i) => (
            <RigaEsercizio
              key={i}
              esercizio={ex}
              catalogo={catalogo}
              onChange={(patch) => aggiornaEsercizio(i, patch)}
              onRemove={() => rimuoviEsercizio(i)}
            />
          ))}
        </div>
        <button type="button" className="btn btn--secondario" onClick={aggiungiEsercizio}>
          + Aggiungi esercizio
        </button>

        {errore && <p className="messaggio-errore">{errore}</p>}
        <button type="submit" className="btn btn--primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva allenamento'}
        </button>
      </form>
    </div>
  );
}
