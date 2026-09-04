import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';

export default function Esercizi() {
  const [catalogo, setCatalogo] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [nome, setNome] = useState('');
  const [immagineUrl, setImmagineUrl] = useState('');
  const [gruppoMuscolare, setGruppoMuscolare] = useState('');
  const [caricamentoImmagine, setCaricamentoImmagine] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');
  const [selezionato, setSelezionato] = useState(null);
  const [gruppoModifica, setGruppoModifica] = useState('');
  const [salvataggioGruppo, setSalvataggioGruppo] = useState(false);
  const [progressione, setProgressione] = useState([]);
  const fileInputRef = useRef(null);

  async function ricarica() {
    const lista = await api.get('/esercizi');
    setCatalogo(lista);
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    setGruppoModifica(selezionato.gruppo_muscolare || '');
    api.get(`/esercizi/${selezionato.id}/progressione`).then((dati) => {
      setProgressione(
        dati.filter((d) => d.peso_kg != null).map((d) => ({ data: d.data, peso: Number(d.peso_kg) }))
      );
    });
  }, [selezionato]);

  async function gestisciFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCaricamentoImmagine(true);
    try {
      const formData = new FormData();
      formData.append('immagine', file);
      const risultato = await api.post('/esercizi/upload-immagine', formData);
      setImmagineUrl(risultato.immagine_url);
    } finally {
      setCaricamentoImmagine(false);
    }
  }

  async function creaEsercizio(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    try {
      await api.post('/esercizi', { nome, immagine_url: immagineUrl || null, gruppo_muscolare: gruppoMuscolare || null });
      setNome('');
      setImmagineUrl('');
      setGruppoMuscolare('');
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  async function salvaGruppoMuscolare() {
    setSalvataggioGruppo(true);
    try {
      await api.put(`/esercizi/${selezionato.id}`, {
        nome: selezionato.nome,
        immagine_url: selezionato.immagine_url,
        gruppo_muscolare: gruppoModifica || null,
      });
      const aggiornato = { ...selezionato, gruppo_muscolare: gruppoModifica || null };
      setSelezionato(aggiornato);
      setCatalogo((prev) => prev.map((e) => (e.id === aggiornato.id ? aggiornato : e)));
    } finally {
      setSalvataggioGruppo(false);
    }
  }

  async function elimina(id) {
    setErrore('');
    try {
      await api.del(`/esercizi/${id}`);
      if (selezionato?.id === id) setSelezionato(null);
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    }
  }

  if (caricamento) return <div className="loading-schermo">Caricamento…</div>;

  return (
    <div className="pagina">
      <h1>Esercizi</h1>

      <form onSubmit={creaEsercizio} className="form pannello">
        <h2>Nuovo esercizio</h2>
        <div className="riga-esercizio">
          <div className="riga-esercizio__immagine" onClick={() => fileInputRef.current?.click()}>
            {immagineUrl ? (
              <img src={immagineUrl} alt="" />
            ) : (
              <span className="riga-esercizio__placeholder">📷</span>
            )}
            {caricamentoImmagine && <span className="riga-esercizio__caricamento">…</span>}
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={gestisciFile} />
          </div>
          <div className="riga-esercizio__campi">
            <input
              placeholder="Nome esercizio (es. Panca piana)"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <input
              placeholder="Muscoli allenati (es. Petto, Tricipiti)"
              value={gruppoMuscolare}
              onChange={(e) => setGruppoMuscolare(e.target.value)}
            />
          </div>
        </div>
        {errore && <p className="messaggio-errore">{errore}</p>}
        <button type="submit" className="btn btn--primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : '+ Aggiungi al catalogo'}
        </button>
      </form>

      {catalogo.length === 0 ? (
        <p className="testo-secondario">Nessun esercizio ancora. Aggiungine uno sopra.</p>
      ) : (
        <div className="lista-esercizi-storico">
          {catalogo.map((e) => (
            <button
              key={e.id}
              className={`chip${selezionato?.id === e.id ? ' chip--attivo' : ''}`}
              onClick={() => setSelezionato(e)}
            >
              {e.immagine_url && <img src={e.immagine_url} alt="" />}
              {e.nome}
              {e.gruppo_muscolare && <span className="chip__dettaglio"> · {e.gruppo_muscolare}</span>}
              {' · '}
              {e.volte_usato}x
            </button>
          ))}
        </div>
      )}

      {selezionato && (
        <div className="pannello">
          <div className="pannello__header">
            <h2>{selezionato.nome}</h2>
            <button
              className="btn btn--testo"
              onClick={() => elimina(selezionato.id)}
              disabled={selezionato.volte_usato > 0}
              title={selezionato.volte_usato > 0 ? 'Già usato in un allenamento' : 'Elimina'}
            >
              Elimina
            </button>
          </div>
          <div className="riga-gruppo-muscolare">
            <input
              placeholder="Muscoli allenati (es. Petto, Tricipiti)"
              value={gruppoModifica}
              onChange={(e) => setGruppoModifica(e.target.value)}
            />
            <button
              type="button"
              className="btn btn--secondario btn--piccolo"
              onClick={salvaGruppoMuscolare}
              disabled={salvataggioGruppo || gruppoModifica === (selezionato.gruppo_muscolare || '')}
            >
              {salvataggioGruppo ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
          {progressione.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={progressione}>
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={36} />
                <Tooltip />
                <Line type="monotone" dataKey="peso" stroke="#1e6feb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="testo-secondario">Servono almeno due sessioni con peso registrato per il grafico.</p>
          )}
        </div>
      )}
    </div>
  );
}
