export default function RigaEsercizio({ esercizio, onCambiaCampo, onBlurCampo, onAggiungiSerie, onRimuoviSerie, onRimuoviEsercizio }) {
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
        </div>

        <button type="button" className="riga-esercizio__rimuovi" onClick={onRimuoviEsercizio} aria-label="Rimuovi esercizio">
          ✕
        </button>
      </div>

      <div className="lista-serie">
        {serie.map((s, i) => (
          <div key={i} className="riga-serie">
            <span className="riga-serie__numero">{i + 1}</span>
            <input
              type="number"
              placeholder="Rip."
              value={s.ripetizioni}
              onChange={(e) => onCambiaCampo(i, 'ripetizioni', e.target.value)}
              onBlur={() => onBlurCampo(i)}
            />
            <input
              type="number"
              step="0.5"
              placeholder="Kg"
              value={s.peso_kg}
              onChange={(e) => onCambiaCampo(i, 'peso_kg', e.target.value)}
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
        ))}
        <button type="button" className="btn btn--testo btn--piccolo" onClick={onAggiungiSerie}>
          + Serie
        </button>
      </div>
    </div>
  );
}
