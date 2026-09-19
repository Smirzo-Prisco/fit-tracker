import { useEffect, useMemo, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';
import { GRUPPI_MUSCOLARI, COLORE_GRUPPO } from '../lib/gruppiMuscolari';
import { trovaEsercizioSimile } from '../lib/similitudineEsercizi';

export default function Esercizi() {
  const [catalogo, setCatalogo] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [ricerca, setRicerca] = useState('');
  const [filtroGruppo, setFiltroGruppo] = useState('');

  // Foglio (bottom sheet): null = chiuso, 'crea' = nuovo esercizio,
  // altrimenti l'oggetto esercizio in corso di modifica.
  const [foglio, setFoglio] = useState(null);

  // Campi condivisi tra creazione e modifica: il foglio mostra sempre solo
  // uno dei due form, mai entrambi, quindi possono condividere lo stato.
  const [nome, setNome] = useState('');
  const [immagineUrl, setImmagineUrl] = useState('');
  // Array { gruppo_muscolare, percentuale }: un esercizio allena più gruppi con pesi
  // diversi (es. Panca piana: Petto 100%, Tricipiti 70%, Spalle 30%), non un gruppo solo.
  const [gruppiMuscolari, setGruppiMuscolari] = useState([]);
  const [caricamentoImmagine, setCaricamentoImmagine] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');
  const [progressioneCarico, setProgressioneCarico] = useState([]);

  const fileInputRef = useRef(null);

  async function ricarica() {
    const lista = await api.get('/esercizi');
    setCatalogo(lista);
    setCaricamento(false);
  }

  useEffect(() => {
    ricarica();
  }, []);

  function apriCreazione() {
    setNome('');
    setImmagineUrl('');
    setGruppiMuscolari([]);
    setErrore('');
    setFoglio('crea');
  }

  function apriModifica(esercizio) {
    setNome(esercizio.nome);
    setImmagineUrl(esercizio.immagine_url || '');
    setGruppiMuscolari(esercizio.gruppi_muscolari || []);
    setErrore('');
    setProgressioneCarico([]);
    setFoglio(esercizio);

    api.get(`/esercizi/${esercizio.id}/progressione`).then((dati) => {
      // Punteggio di carico per sessione: somma di ripetizioni × kg × (RPE/10) di tutte
      // le serie di quella data (solo quelle con RPE registrato — dati storici pre-RPE
      // non contribuiscono, non vanno trattati come punteggio 0).
      const perData = new Map();
      for (const d of dati) {
        if (d.ripetizioni == null || d.peso_kg == null || d.rpe == null) continue;
        const punteggio = Number(d.ripetizioni) * Number(d.peso_kg) * (Number(d.rpe) / 10);
        perData.set(d.data, (perData.get(d.data) || 0) + punteggio);
      }
      setProgressioneCarico(
        [...perData.entries()]
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([data, punteggio]) => ({ data: formattaData(data), punteggio: Math.round(punteggio) }))
      );
    });
  }

  function chiudiFoglio() {
    setFoglio(null);
  }

  async function caricaImmagine(file) {
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

  function aggiungiGruppo() {
    const disponibile = GRUPPI_MUSCOLARI.find((g) => !gruppiMuscolari.some((r) => r.gruppo_muscolare === g));
    if (!disponibile) return;
    setGruppiMuscolari((prev) => [...prev, { gruppo_muscolare: disponibile, percentuale: 100 }]);
  }

  function aggiornaGruppo(indice, campo, valore) {
    setGruppiMuscolari((prev) => prev.map((r, i) => (i === indice ? { ...r, [campo]: valore } : r)));
  }

  function rimuoviGruppo(indice) {
    setGruppiMuscolari((prev) => prev.filter((_, i) => i !== indice));
  }

  async function salvaCreazione(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    try {
      await api.post('/esercizi', {
        nome,
        immagine_url: immagineUrl || null,
        gruppi_muscolari: gruppiMuscolari,
      });
      chiudiFoglio();
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  async function salvaModifiche() {
    setErrore('');
    setSalvataggio(true);
    try {
      await api.put(`/esercizi/${foglio.id}`, {
        nome,
        immagine_url: immagineUrl || null,
        gruppi_muscolari: gruppiMuscolari,
      });
      const aggiornato = { ...foglio, nome, immagine_url: immagineUrl || null, gruppi_muscolari: gruppiMuscolari };
      setFoglio(aggiornato);
      setCatalogo((prev) => prev.map((e) => (e.id === aggiornato.id ? aggiornato : e)));
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  async function elimina(id) {
    if (!window.confirm('Eliminare questo esercizio? Non è reversibile.')) return;
    setErrore('');
    try {
      await api.del(`/esercizi/${id}`);
      chiudiFoglio();
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    }
  }

  const inModifica = foglio && foglio !== 'crea';
  const modificheInSospeso =
    inModifica &&
    (nome !== foglio.nome ||
      immagineUrl !== (foglio.immagine_url || '') ||
      JSON.stringify(gruppiMuscolari) !== JSON.stringify(foglio.gruppi_muscolari || []));

  const catalogoFiltrato = catalogo.filter((e) => {
    const passaGruppo = !filtroGruppo || (e.gruppi_muscolari || []).some((g) => g.gruppo_muscolare === filtroGruppo);
    const passaRicerca = !ricerca.trim() || e.nome.toLowerCase().includes(ricerca.trim().toLowerCase());
    return passaGruppo && passaRicerca;
  });

  // Avviso (non bloccante) se il nome digitato è uguale o molto simile a uno già
  // in catalogo — evita doppioni tipo "Chest press" / "Chest Press" / "Ches press"
  // che frammenterebbero lo storico dell'esercizio. In modifica esclude l'esercizio
  // stesso, altrimenti troverebbe sempre "se stesso" come duplicato esatto.
  const esercizioSimile = useMemo(
    () => trovaEsercizioSimile(nome, catalogo, inModifica ? foglio.id : null),
    [nome, catalogo, inModifica, foglio]
  );

  const avvisoSimile = esercizioSimile && (
    <p className="messaggio-avviso">
      <span>
        {esercizioSimile.esatto ? 'Esiste già un esercizio con questo nome: ' : 'Esiste già un esercizio simile: '}
        <strong>{esercizioSimile.esercizio.nome}</strong>
      </span>
      {!inModifica && (
        <button type="button" className="btn btn--testo btn--piccolo" onClick={() => apriModifica(esercizioSimile.esercizio)}>
          Apri invece questo
        </button>
      )}
    </p>
  );

  const editoreGruppi = (
    <div className="editore-gruppi">
      <span className="editore-gruppi__etichetta">Muscoli allenati</span>
      {gruppiMuscolari.map((riga, i) => (
        <div className="editore-gruppi__riga" key={riga.gruppo_muscolare}>
          <select
            value={riga.gruppo_muscolare}
            onChange={(e) => aggiornaGruppo(i, 'gruppo_muscolare', e.target.value)}
          >
            {GRUPPI_MUSCOLARI.filter(
              (g) => g === riga.gruppo_muscolare || !gruppiMuscolari.some((r) => r.gruppo_muscolare === g)
            ).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            max="100"
            value={riga.percentuale}
            onChange={(e) => aggiornaGruppo(i, 'percentuale', e.target.value)}
          />
          <span>%</span>
          <button
            type="button"
            className="riga-serie__rimuovi"
            onClick={() => rimuoviGruppo(i)}
            aria-label="Rimuovi gruppo muscolare"
          >
            ✕
          </button>
        </div>
      ))}
      {gruppiMuscolari.length < GRUPPI_MUSCOLARI.length && (
        <button type="button" className="btn btn--testo editore-gruppi__aggiungi" onClick={aggiungiGruppo}>
          + Muscolo
        </button>
      )}
    </div>
  );

  if (caricamento) return <div className="loading-schermo">Caricamento…</div>;

  return (
    <div className="pagina">
      <h1>Esercizi</h1>

      <div className="barra-ricerca">
        <input
          type="search"
          placeholder="Cerca esercizio…"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
        />
        <button type="button" className="barra-ricerca__aggiungi" onClick={apriCreazione} aria-label="Nuovo esercizio">
          +
        </button>
      </div>

      {catalogo.length > 0 && (
        <div className="filtri-gruppo">
          <button
            type="button"
            className={`filtro-gruppo${filtroGruppo === '' ? ' filtro-gruppo--attivo' : ''}`}
            onClick={() => setFiltroGruppo('')}
          >
            Tutti
          </button>
          {GRUPPI_MUSCOLARI.map((g) => (
            <button
              key={g}
              type="button"
              className={`filtro-gruppo${filtroGruppo === g ? ' filtro-gruppo--attivo' : ''}`}
              onClick={() => setFiltroGruppo(filtroGruppo === g ? '' : g)}
            >
              <span className="filtro-gruppo__puntino" style={{ background: COLORE_GRUPPO[g] }} />
              {g}
            </button>
          ))}
        </div>
      )}

      {catalogo.length === 0 ? (
        <p className="testo-secondario">Nessun esercizio ancora. Aggiungine uno con +.</p>
      ) : catalogoFiltrato.length === 0 ? (
        <p className="testo-secondario">Nessun esercizio corrisponde alla ricerca.</p>
      ) : (
        <div className="lista-esercizi-catalogo">
          {catalogoFiltrato.map((e) => (
            <button key={e.id} type="button" className="pannello riga-catalogo" onClick={() => apriModifica(e)}>
              <span className="riga-catalogo__immagine">
                {e.immagine_url ? (
                  <img src={e.immagine_url} alt="" />
                ) : (
                  <span className="riga-esercizio__placeholder">🏋️</span>
                )}
              </span>
              <span className="riga-catalogo__testi">
                <span className="riga-catalogo__nome">{e.nome}</span>
                <span className="riga-catalogo__meta">
                  {(e.gruppi_muscolari || []).map((g) => (
                    <span key={g.gruppo_muscolare} className="riga-catalogo__gruppo">
                      <span className="filtro-gruppo__puntino" style={{ background: COLORE_GRUPPO[g.gruppo_muscolare] }} />
                      {g.gruppo_muscolare} {g.percentuale}%
                    </span>
                  ))}
                  {e.gruppi_muscolari?.length > 0 && ' · '}
                  {e.volte_usato}x
                </span>
              </span>
              <span className="riga-catalogo__freccia">›</span>
            </button>
          ))}
        </div>
      )}

      {foglio && (
        <div className="foglio-overlay" onClick={chiudiFoglio}>
          <div className="foglio" onClick={(e) => e.stopPropagation()}>
            <div className="foglio__maniglia" />

            {foglio === 'crea' ? (
              <form onSubmit={salvaCreazione}>
                <div className="foglio__header">
                  <h2>Nuovo esercizio</h2>
                  <button type="button" className="foglio__chiudi" onClick={chiudiFoglio} aria-label="Chiudi">
                    ✕
                  </button>
                </div>

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
                      onChange={(e) => e.target.files[0] && caricaImmagine(e.target.files[0])}
                    />
                  </div>
                  <div className="riga-esercizio__campi">
                    <input
                      placeholder="Nome esercizio (es. Panca piana)"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {editoreGruppi}
                {avvisoSimile}

                {errore && <p className="messaggio-errore">{errore}</p>}
                <button type="submit" className="btn btn--primario" disabled={salvataggio}>
                  {salvataggio ? 'Salvataggio…' : '+ Aggiungi al catalogo'}
                </button>
              </form>
            ) : (
              <>
                <div className="foglio__header">
                  <h2>Modifica esercizio</h2>
                  <button type="button" className="foglio__chiudi" onClick={chiudiFoglio} aria-label="Chiudi">
                    ✕
                  </button>
                </div>

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
                      onChange={(e) => e.target.files[0] && caricaImmagine(e.target.files[0])}
                    />
                  </div>
                  <div className="riga-esercizio__campi">
                    <input value={nome} onChange={(e) => setNome(e.target.value)} required />
                  </div>
                </div>

                {editoreGruppi}
                {avvisoSimile}

                {errore && <p className="messaggio-errore">{errore}</p>}
                <div className="foglio__azioni">
                  <button
                    type="button"
                    className="btn btn--secondario btn--piccolo"
                    onClick={salvaModifiche}
                    disabled={salvataggio || !modificheInSospeso}
                  >
                    {salvataggio ? 'Salvataggio…' : 'Salva modifiche'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--testo"
                    onClick={() => elimina(foglio.id)}
                    disabled={foglio.volte_usato > 0}
                    title={foglio.volte_usato > 0 ? 'Già usato in un allenamento' : 'Elimina'}
                  >
                    Elimina
                  </button>
                </div>

                <h3>Punteggio di carico per sessione</h3>
                {progressioneCarico.length > 1 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={progressioneCarico}>
                      <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={44} />
                      <Tooltip />
                      <Line type="monotone" dataKey="punteggio" stroke="#e5484d" strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="testo-secondario">
                    Servono almeno due sessioni con RPE registrato per questo grafico (ripetizioni × kg × RPE/10).
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
