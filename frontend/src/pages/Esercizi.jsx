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
  const [modificaNome, setModificaNome] = useState('');
  const [modificaImmagineUrl, setModificaImmagineUrl] = useState('');
  const [modificaGruppo, setModificaGruppo] = useState('');
  const [caricamentoImmagineModifica, setCaricamentoImmagineModifica] = useState(false);
  const [salvataggioModifica, setSalvataggioModifica] = useState(false);
  const [erroreModifica, setErroreModifica] = useState('');
  const [progressione, setProgressione] = useState([]);

  const fileInputRef = useRef(null);
  const fileInputModificaRef = useRef(null);

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
    setModificaNome(selezionato.nome);
    setModificaImmagineUrl(selezionato.immagine_url || '');
    setModificaGruppo(selezionato.gruppo_muscolare || '');
    setErroreModifica('');
    api.get(`/esercizi/${selezionato.id}/progressione`).then((dati) => {
      setProgressione(
        dati.filter((d) => d.peso_kg != null).map((d) => ({ data: d.data, peso: Number(d.peso_kg) }))
      );
    });
  }, [selezionato]);

  async function caricaImmagine(file, onFatto, setCaricamento) {
    setCaricamento(true);
    try {
      const formData = new FormData();
      formData.append('immagine', file);
      const risultato = await api.post('/esercizi/upload-immagine', formData);
      onFatto(risultato.immagine_url);
    } finally {
      setCaricamento(false);
    }
  }

  async function creaEsercizio(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    try {
      await api.post('/esercizi', {
        nome,
        immagine_url: immagineUrl || null,
        gruppo_muscolare: gruppoMuscolare || null,
      });
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

  async function salvaModifiche() {
    setErroreModifica('');
    setSalvataggioModifica(true);
    try {
      await api.put(`/esercizi/${selezionato.id}`, {
        nome: modificaNome,
        immagine_url: modificaImmagineUrl || null,
        gruppo_muscolare: modificaGruppo || null,
      });
      const aggiornato = {
        ...selezionato,
        nome: modificaNome,
        immagine_url: modificaImmagineUrl || null,
        gruppo_muscolare: modificaGruppo || null,
      };
      setSelezionato(aggiornato);
      setCatalogo((prev) => prev.map((e) => (e.id === aggiornato.id ? aggiornato : e)));
    } catch (err) {
      setErroreModifica(err.message);
    } finally {
      setSalvataggioModifica(false);
    }
  }

  async function elimina(id) {
    setErroreModifica('');
    try {
      await api.del(`/esercizi/${id}`);
      if (selezionato?.id === id) setSelezionato(null);
      await ricarica();
    } catch (err) {
      setErroreModifica(err.message);
    }
  }

  const modificheInSospeso =
    selezionato &&
    (modificaNome !== selezionato.nome ||
      modificaImmagineUrl !== (selezionato.immagine_url || '') ||
      modificaGruppo !== (selezionato.gruppo_muscolare || ''));

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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files[0] && caricaImmagine(e.target.files[0], setImmagineUrl, setCaricamentoImmagine)}
            />
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
            <h2>Modifica esercizio</h2>
            <button
              className="btn btn--testo"
              onClick={() => elimina(selezionato.id)}
              disabled={selezionato.volte_usato > 0}
              title={selezionato.volte_usato > 0 ? 'Già usato in un allenamento' : 'Elimina'}
            >
              Elimina
            </button>
          </div>

          <div className="riga-esercizio">
            <div className="riga-esercizio__immagine" onClick={() => fileInputModificaRef.current?.click()}>
              {modificaImmagineUrl ? (
                <img src={modificaImmagineUrl} alt="" />
              ) : (
                <span className="riga-esercizio__placeholder">📷</span>
              )}
              {caricamentoImmagineModifica && <span className="riga-esercizio__caricamento">…</span>}
              <input
                ref={fileInputModificaRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) =>
                  e.target.files[0] &&
                  caricaImmagine(e.target.files[0], setModificaImmagineUrl, setCaricamentoImmagineModifica)
                }
              />
            </div>
            <div className="riga-esercizio__campi">
              <input value={modificaNome} onChange={(e) => setModificaNome(e.target.value)} required />
              <input
                placeholder="Muscoli allenati (es. Petto, Tricipiti)"
                value={modificaGruppo}
                onChange={(e) => setModificaGruppo(e.target.value)}
              />
            </div>
          </div>

          {erroreModifica && <p className="messaggio-errore">{erroreModifica}</p>}
          <button
            type="button"
            className="btn btn--secondario btn--piccolo"
            onClick={salvaModifiche}
            disabled={salvataggioModifica || !modificheInSospeso}
          >
            {salvataggioModifica ? 'Salvataggio…' : 'Salva modifiche'}
          </button>

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
