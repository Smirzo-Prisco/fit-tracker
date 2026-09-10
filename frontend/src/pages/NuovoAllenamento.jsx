import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import RigaEsercizio from '../components/RigaEsercizio.jsx';

// Punteggio di carico (Training Load Score): ripetizioni × kg × (RPE/10), sommato su ogni
// serie che ha tutti e tre i valori — ricalcolato lato client per un riscontro immediato
// mentre si compila, senza aspettare il giro di andata/ritorno col server.
function punteggioTotale(esercizi) {
  let totale = 0;
  let almenoUna = false;
  for (const e of esercizi) {
    for (const s of e.serie) {
      if (s.ripetizioni === '' || s.peso_kg === '' || s.rpe === '') continue;
      almenoUna = true;
      totale += Number(s.ripetizioni) * Number(s.peso_kg) * (Number(s.rpe) / 10);
    }
  }
  return almenoUna ? Math.round(totale) : null;
}

// Stessa formula, ma su un elenco grezzo di serie {ripetizioni, peso_kg, rpe} come
// arrivano da GET /esercizi/:id/ultima-sessione (usato per il punteggio di riferimento).
function punteggioSerieList(serieList) {
  let totale = 0;
  for (const s of serieList) {
    if (s.ripetizioni == null || s.peso_kg == null || s.rpe == null) continue;
    totale += Number(s.ripetizioni) * Number(s.peso_kg) * (Number(s.rpe) / 10);
  }
  return totale;
}

// Recupera le serie dell'ultima volta che l'esercizio è stato svolto (in un allenamento
// diverso da quello corrente). In caso di errore di rete non blocca l'aggiunta
// dell'esercizio, semplicemente non ci sarà storico da mostrare.
async function caricaStorico(esercizioId, allenamentoIdCorrente) {
  try {
    return await api.get(`/esercizi/${esercizioId}/ultima-sessione?escludi=${allenamentoIdCorrente}`);
  } catch {
    return { data: null, serie: [] };
  }
}

// Crea automaticamente tante serie vuote quante l'ultima volta, con quei valori SOLO
// come placeholder (mai come value): restano un riferimento da superare, non vengono
// salvati finché non li digiti tu stesso. Usata quando l'esercizio viene aggiunto ex
// novo, ma anche riaprendo un allenamento già iniziato (vedi conRiferimenti) — una riga
// placeholder mai compilata non è mai stata salvata, quindi va ricreata ad ogni apertura.
function serieDaStorico(serieStorico) {
  return serieStorico.map((rif) => ({ id: null, ripetizioni: '', peso_kg: '', rpe: '', riferimento: rif }));
}

// Aggancia i valori di riferimento alle serie già salvate (posizione per posizione) e,
// se lo storico ne ha di più, aggiunge le righe placeholder mancanti — quelle non
// compilate l'ultima apertura non erano mai state salvate, quindi vanno riproposte.
function conRiferimenti(serieEsistenti, serieStorico) {
  const risultato = serieEsistenti.map((s, i) => ({ ...s, riferimento: serieStorico[i] || null }));
  for (let i = serieEsistenti.length; i < serieStorico.length; i += 1) {
    risultato.push({ id: null, ripetizioni: '', peso_kg: '', rpe: '', riferimento: serieStorico[i] });
  }
  return risultato;
}

export default function NuovoAllenamento() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [catalogo, setCatalogo] = useState(null);
  const [schede, setSchede] = useState([]);
  const [schedaId, setSchedaId] = useState('');
  const [schedaEsercizi, setSchedaEsercizi] = useState([]);
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
          storicoCaricato: false,
          haStorico: false,
          storicoPunteggio: 0,
          serie: e.serie.map((s) => ({
            id: s.id,
            ripetizioni: s.ripetizioni ?? '',
            peso_kg: s.peso_kg ?? '',
            rpe: s.rpe ?? '',
          })),
        }))
      );
      if (a.scheda_id) {
        const scheda = await api.get(`/schede/${a.scheda_id}`);
        setSchedaEsercizi(scheda.esercizi);
      }
      setCaricamento(false);

      // Storico per ogni esercizio già presente (badge "nuovo"/punteggio di riferimento),
      // anche riaprendo un allenamento già iniziato — senza aggiungere nuove serie.
      for (const e of a.esercizi) {
        const storico = await caricaStorico(e.esercizio_id, id);
        setEsercizi((prev) =>
          prev.map((riga) =>
            riga.id === e.id
              ? {
                  ...riga,
                  serie: conRiferimenti(riga.serie, storico.serie),
                  haStorico: storico.serie.length > 0,
                  storicoCaricato: true,
                  storicoPunteggio: punteggioSerieList(storico.serie),
                }
              : riga
          )
        );
      }
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
    if (!nuovoSchedaId) {
      setSchedaEsercizi([]);
      return;
    }
    const scheda = await api.get(`/schede/${nuovoSchedaId}`);
    setSchedaEsercizi(scheda.esercizi);
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
      setEsercizi((prev) => [...prev, { ...riga, storicoCaricato: false, haStorico: false, storicoPunteggio: 0 }]);
      setErroreSalvataggio('');

      // Precompila automaticamente le stesse serie dell'ultima volta (come placeholder)
      // e calcola il punteggio di riferimento da battere — arriva un attimo dopo,
      // la riga dell'esercizio intanto è già visibile e utilizzabile.
      const storico = await caricaStorico(esercizioId, id);
      setEsercizi((prev) =>
        prev.map((e) =>
          e.id === riga.id
            ? {
                ...e,
                serie: serieDaStorico(storico.serie),
                haStorico: storico.serie.length > 0,
                storicoCaricato: true,
                storicoPunteggio: punteggioSerieList(storico.serie),
              }
            : e
        )
      );
    } catch (err) {
      setErroreSalvataggio("Impossibile aggiungere l'esercizio: " + err.message);
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
        i === indiceEsercizio
          ? { ...e, serie: [...e.serie, { id: null, ripetizioni: '', peso_kg: '', rpe: '' }] }
          : e
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
    const vuota = !riga.ripetizioni && !riga.peso_kg && !riga.rpe;

    if (vuota) {
      if (!riga.id) return; // placeholder mai salvata: niente da fare
      // Aveva almeno un valore salvato ed è stata svuotata del tutto: va cancellata
      // dal server, altrimenti il vecchio valore resterebbe come dato "fantasma" che
      // ricompare al prossimo caricamento nonostante l'avessi cancellato dal campo.
      await segnalaErrore(api.del(`/allenamenti/${id}/esercizi/${esercizio.id}/serie/${riga.id}`));
      setEsercizi((prev) =>
        prev.map((e, i) =>
          i === indiceEsercizio
            ? { ...e, serie: e.serie.map((s, j) => (j === indiceSerie ? { ...s, id: null } : s)) }
            : e
        )
      );
      return;
    }

    try {
      if (riga.id) {
        await api.put(`/allenamenti/${id}/esercizi/${esercizio.id}/serie/${riga.id}`, {
          ripetizioni: riga.ripetizioni || null,
          peso_kg: riga.peso_kg || null,
          rpe: riga.rpe || null,
        });
      } else {
        const risultato = await api.post(`/allenamenti/${id}/esercizi/${esercizio.id}/serie`, {
          ripetizioni: riga.ripetizioni || null,
          peso_kg: riga.peso_kg || null,
          rpe: riga.rpe || null,
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

  const punteggio = useMemo(() => punteggioTotale(esercizi), [esercizi]);

  // Somma dei punteggi dell'ultima volta, solo per gli esercizi attualmente presenti
  // in questo allenamento — il riferimento da superare cambia con quello che stai
  // effettivamente facendo oggi (aggiungere/togliere un esercizio lo ricalcola).
  const punteggioBaseline = useMemo(() => {
    let totale = 0;
    let almenoUno = false;
    for (const e of esercizi) {
      if (e.haStorico) {
        totale += e.storicoPunteggio;
        almenoUno = true;
      }
    }
    return almenoUno ? Math.round(totale) : null;
  }, [esercizi]);

  const eserciziSenzaStorico = useMemo(
    () => esercizi.filter((e) => e.storicoCaricato && !e.haStorico).map((e) => e.nome),
    [esercizi]
  );

  const eserciziMancantiDaScheda = useMemo(() => {
    const presentiIds = new Set(esercizi.map((e) => String(e.esercizio_id)));
    return schedaEsercizi.filter((se) => !presentiIds.has(String(se.esercizio_id))).map((se) => se.nome);
  }, [esercizi, schedaEsercizi]);

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
      {punteggio != null && (
        <p className="testo-secondario">
          Punteggio di carico: <strong>{punteggio}</strong>
          {punteggioBaseline != null && (
            <>
              {' '}
              (ultima volta per questi esercizi: {punteggioBaseline},{' '}
              <strong>
                {punteggio - punteggioBaseline >= 0 ? '+' : ''}
                {punteggio - punteggioBaseline}
              </strong>
              )
            </>
          )}
        </p>
      )}
      {eserciziSenzaStorico.length > 0 && (
        <p className="testo-secondario">🆕 Senza dati precedenti: {eserciziSenzaStorico.join(', ')}</p>
      )}
      {eserciziMancantiDaScheda.length > 0 && (
        <p className="testo-secondario">⚠️ Mancano dalla scheda: {eserciziMancantiDaScheda.join(', ')}</p>
      )}

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
