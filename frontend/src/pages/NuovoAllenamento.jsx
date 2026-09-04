import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import RigaEsercizio from '../components/RigaEsercizio.jsx';

export default function NuovoAllenamento() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [catalogo, setCatalogo] = useState(null);
  const [schede, setSchede] = useState([]);
  const [schedaId, setSchedaId] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [durataMin, setDurataMin] = useState('');
  const [note, setNote] = useState('');
  const [esercizi, setEsercizi] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [erroreSalvataggio, setErroreSalvataggio] = useState('');
  const creazioneAvviata = useRef(false);

  useEffect(() => {
    api.get('/esercizi').then(setCatalogo);
    api.get('/schede').then(setSchede);
  }, []);

  // Se si arriva senza :id, crea subito l'allenamento (solo data odierna) e passa
  // alla stessa pagina in modalità modifica: da qui in poi ogni azione salva istantaneamente.
  useEffect(() => {
    if (id || creazioneAvviata.current) return;
    creazioneAvviata.current = true;
    api.post('/allenamenti', { data }).then((r) => navigate(`/allenamenti/${r.id}/modifica`, { replace: true }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;
    (async () => {
      const a = await api.get(`/allenamenti/${id}`);
      setData(a.data);
      setDurataMin(a.durata_min || '');
      setNote(a.note || '');
      setSchedaId(a.scheda_id || '');
      setEsercizi(
        a.esercizi.map((e) => ({
          ...e,
          serie: e.serie.map((s) => ({ id: s.id, ripetizioni: s.ripetizioni ?? '', peso_kg: s.peso_kg ?? '' })),
        }))
      );
      setCaricamento(false);
    })();
  }, [id]);

  async function segnalaErrore(promessa) {
    try {
      await promessa;
      setErroreSalvataggio('');
    } catch (err) {
      setErroreSalvataggio('Salvataggio non riuscito, controlla la connessione e riprova: ' + err.message);
    }
  }

  function salvaCampiTop(campi) {
    segnalaErrore(
      api.put(`/allenamenti/${id}`, {
        data,
        durata_min: durataMin || null,
        note,
        scheda_id: schedaId || null,
        ...campi,
      })
    );
  }

  async function caricaDaScheda(nuovoSchedaId) {
    setSchedaId(nuovoSchedaId);
    salvaCampiTop({ scheda_id: nuovoSchedaId || null });
    if (!nuovoSchedaId) return;
    const scheda = await api.get(`/schede/${nuovoSchedaId}`);
    const idGiaPresenti = new Set(esercizi.map((e) => String(e.esercizio_id)));
    for (const es of scheda.esercizi) {
      if (idGiaPresenti.has(String(es.esercizio_id))) continue;
      await aggiungiEsercizio(es.esercizio_id);
    }
  }

  async function aggiungiEsercizio(esercizioId) {
    if (!esercizioId) return;
    try {
      const riga = await api.post(`/allenamenti/${id}/esercizi`, { esercizio_id: esercizioId });
      setEsercizi((prev) => [...prev, riga]);
      setErroreSalvataggio('');
    } catch (err) {
      setErroreSalvataggio('Impossibile aggiungere l\'esercizio: ' + err.message);
    }
  }

  async function rimuoviEsercizio(indice) {
    const riga = esercizi[indice];
    setEsercizi((prev) => prev.filter((_, i) => i !== indice));
    if (riga.id) {
      await segnalaErrore(api.del(`/allenamenti/${id}/esercizi/${riga.id}`));
    }
  }

  function aggiungiSerie(indiceEsercizio) {
    setEsercizi((prev) =>
      prev.map((e, i) =>
        i === indiceEsercizio ? { ...e, serie: [...e.serie, { id: null, ripetizioni: '', peso_kg: '' }] } : e
      )
    );
  }

  function cambiaCampoSerie(indiceEsercizio, indiceSerie, campo, valore) {
    setEsercizi((prev) =>
      prev.map((e, i) =>
        i === indiceEsercizio
          ? { ...e, serie: e.serie.map((s, j) => (j === indiceSerie ? { ...s, [campo]: valore } : s)) }
          : e
      )
    );
  }

  async function blurCampoSerie(indiceEsercizio, indiceSerie) {
    const esercizio = esercizi[indiceEsercizio];
    const riga = esercizio.serie[indiceSerie];
    if (!riga.ripetizioni && !riga.peso_kg) return; // niente da salvare

    try {
      if (riga.id) {
        await api.put(`/allenamenti/${id}/esercizi/${esercizio.id}/serie/${riga.id}`, {
          ripetizioni: riga.ripetizioni || null,
          peso_kg: riga.peso_kg || null,
        });
      } else {
        const risultato = await api.post(`/allenamenti/${id}/esercizi/${esercizio.id}/serie`, {
          ripetizioni: riga.ripetizioni || null,
          peso_kg: riga.peso_kg || null,
        });
        setEsercizi((prev) =>
          prev.map((e, i) =>
            i === indiceEsercizio
              ? { ...e, serie: e.serie.map((s, j) => (j === indiceSerie ? { ...s, id: risultato.id } : s)) }
              : e
          )
        );
      }
      setErroreSalvataggio('');
    } catch (err) {
      setErroreSalvataggio('Salvataggio serie non riuscito: ' + err.message);
    }
  }

  async function rimuoviSerie(indiceEsercizio, indiceSerie) {
    const esercizio = esercizi[indiceEsercizio];
    const riga = esercizio.serie[indiceSerie];
    setEsercizi((prev) =>
      prev.map((e, i) => (i === indiceEsercizio ? { ...e, serie: e.serie.filter((_, j) => j !== indiceSerie) } : e))
    );
    if (riga.id) {
      await segnalaErrore(api.del(`/allenamenti/${id}/esercizi/${esercizio.id}/serie/${riga.id}`));
    }
  }

  if (!id || caricamento || catalogo === null) {
    return <div className="loading-schermo">Caricamento…</div>;
  }

  return (
    <div className="pagina">
      <div className="pagina__header">
        <h1>Allenamento</h1>
        <button type="button" className="btn btn--primario" onClick={() => navigate('/allenamenti')}>
          Fatto
        </button>
      </div>
      <p className="testo-secondario">Ogni dato si salva da solo appena esci dal campo.</p>

      {erroreSalvataggio && <p className="messaggio-errore">{erroreSalvataggio}</p>}

      <div className="form">
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
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              onBlur={() => salvaCampiTop({})}
              required
            />
          </label>
          <label>
            Durata (min)
            <input
              type="number"
              value={durataMin}
              onChange={(e) => setDurataMin(e.target.value)}
              onBlur={() => salvaCampiTop({})}
            />
          </label>
        </div>
        <label>
          Note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => salvaCampiTop({})} rows={2} />
        </label>

        <h2>Esercizi</h2>
        {catalogo.length === 0 ? (
          <p className="testo-secondario">
            Nessun esercizio nel catalogo. <Link to="/esercizi">Creane uno</Link> prima di continuare.
          </p>
        ) : (
          <>
            <div className="lista-righe-esercizio">
              {esercizi.map((es, i) => (
                <RigaEsercizio
                  key={es.id}
                  esercizio={es}
                  onCambiaCampo={(iSerie, campo, valore) => cambiaCampoSerie(i, iSerie, campo, valore)}
                  onBlurCampo={(iSerie) => blurCampoSerie(i, iSerie)}
                  onAggiungiSerie={() => aggiungiSerie(i)}
                  onRimuoviSerie={(iSerie) => rimuoviSerie(i, iSerie)}
                  onRimuoviEsercizio={() => rimuoviEsercizio(i)}
                />
              ))}
            </div>
            <select value="" onChange={(e) => aggiungiEsercizio(e.target.value)}>
              <option value="" disabled>
                + Aggiungi esercizio…
              </option>
              {catalogo.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
