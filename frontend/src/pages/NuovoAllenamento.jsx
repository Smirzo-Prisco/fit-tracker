import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import RigaEsercizio from '../components/RigaEsercizio.jsx';

const RIGA_VUOTA = { nome: '', immagine_url: '', serie: '', ripetizioni: '', peso_kg: '' };

export default function NuovoAllenamento() {
  const { id } = useParams();
  const navigate = useNavigate();
  const inModifica = Boolean(id);

  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [durataMin, setDurataMin] = useState('');
  const [note, setNote] = useState('');
  const [esercizi, setEsercizi] = useState([{ ...RIGA_VUOTA }]);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');

  useEffect(() => {
    if (!inModifica) return;
    (async () => {
      const a = await api.get(`/allenamenti/${id}`);
      setData(a.data);
      setDurataMin(a.durata_min || '');
      setNote(a.note || '');
      setEsercizi(
        a.esercizi.length
          ? a.esercizi.map((e) => ({
              nome: e.nome,
              immagine_url: e.immagine_url || '',
              serie: e.serie ?? '',
              ripetizioni: e.ripetizioni ?? '',
              peso_kg: e.peso_kg ?? '',
            }))
          : [{ ...RIGA_VUOTA }]
      );
    })();
  }, [id, inModifica]);

  function aggiornaEsercizio(indice, patch) {
    setEsercizi((prev) => prev.map((e, i) => (i === indice ? { ...e, ...patch } : e)));
  }

  function rimuoviEsercizio(indice) {
    setEsercizi((prev) => prev.filter((_, i) => i !== indice));
  }

  function aggiungiEsercizio() {
    setEsercizi((prev) => [...prev, { ...RIGA_VUOTA }]);
  }

  async function invia(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    const payload = {
      data,
      durata_min: durataMin || null,
      note,
      esercizi: esercizi
        .filter((ex) => ex.nome.trim())
        .map((ex) => ({
          ...ex,
          serie: ex.serie || null,
          ripetizioni: ex.ripetizioni || null,
          peso_kg: ex.peso_kg || null,
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

  return (
    <div className="pagina">
      <h1>{inModifica ? 'Modifica allenamento' : 'Nuovo allenamento'}</h1>

      <form onSubmit={invia} className="form">
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
