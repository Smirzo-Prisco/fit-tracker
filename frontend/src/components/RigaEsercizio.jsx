export default function RigaEsercizio({
  esercizio,
  punteggioReale,
  punteggioProiettato,
  onCambiaCampo,
  onBlurCampo,
  onAggiungiSerie,
  onRimuoviSerie,
  onRimuoviEsercizio,
}) {
  const serie = esercizio.serie || [];

  return (
    <div className="blocco-esercizio">
      <div className="riga-esercizio">
        <div className="riga-esercizio__immagine">
          {esercizio.immagine_url ? (
            <img src={esercizio.immagine_url} alt={esercizio.nome} />
          ) : (
            <span className="riga-esercizio__placeholder">🏋️</span>
          )}
        </div>

        <div className="riga-esercizio__campi">
          <span className="riga-esercizio__nome-fisso">{esercizio.nome}</span>
          {punteggioProiettato != null && (
            <span className="riga-esercizio__punteggio">
              🏋️ {punteggioProiettato}
              {punteggioReale != null && punteggioReale !== punteggioProiettato && ` (${punteggioReale} registrato)`}
            </span>
          )}
          {esercizio.storicoCaricato && !esercizio.haStorico && (
            <span className="badge-nuovo">nuovo, nessun dato precedente</span>
          )}
        </div>

        <button type="button" className="riga-esercizio__rimuovi" onClick={onRimuoviEsercizio} aria-label="Rimuovi esercizio">
          ✕
        </button>
      </div>

      <div className="lista-serie">
        {serie.map((s, i) => {
          // Valori dell'ultima volta per questa stessa posizione di serie, mostrati SOLO
          // come placeholder (mai come value): restano un riferimento da superare, non
          // vengono mai salvati finché non li digiti tu stesso.
          const rif = s.riferimento || {};
          return (
            <div key={i} className="riga-serie">
              <span className="riga-serie__numero">{i + 1}</span>
              <input
                type="number"
                placeholder={rif.ripetizioni != null ? String(rif.ripetizioni) : 'Rip.'}
                value={s.ripetizioni}
                onChange={(e) => onCambiaCampo(i, 'ripetizioni', e.target.value)}
                onBlur={() => onBlurCampo(i)}
              />
              <input
                type="number"
                step="0.5"
                placeholder={rif.peso_kg != null ? String(rif.peso_kg) : 'Kg'}
                value={s.peso_kg}
                onChange={(e) => onCambiaCampo(i, 'peso_kg', e.target.value)}
                onBlur={() => onBlurCampo(i)}
              />
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                placeholder={rif.rpe != null ? String(rif.rpe) : 'RPE'}
                title="RPE — sforzo percepito, 1 (facilissimo) - 10 (cedimento)"
                value={s.rpe}
                onChange={(e) => onCambiaCampo(i, 'rpe', e.target.value)}
                onBlur={() => onBlurCampo(i)}
              />
              <button
                type="button"
                className="riga-serie__rimuovi"
                onClick={() => onRimuoviSerie(i)}
                aria-label="Rimuovi serie"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button type="button" className="btn btn--testo btn--piccolo" onClick={onAggiungiSerie}>
          + Serie
        </button>
      </div>
    </div>
  );
}
