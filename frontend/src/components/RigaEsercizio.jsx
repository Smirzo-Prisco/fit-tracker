export default function RigaEsercizio({ esercizio, catalogo, onChange, onRemove }) {
  const selezionato = catalogo.find((e) => String(e.id) === String(esercizio.esercizio_id));
  const serie = esercizio.serie || [];

  function aggiornaSerie(indice, patch) {
    onChange({ serie: serie.map((s, i) => (i === indice ? { ...s, ...patch } : s)) });
  }

  function aggiungiSerie() {
    onChange({ serie: [...serie, { ripetizioni: '', peso_kg: '' }] });
  }

  function rimuoviSerie(indice) {
    onChange({ serie: serie.filter((_, i) => i !== indice) });
  }

  return (
    <div className="blocco-esercizio">
      <div className="riga-esercizio">
        <div className="riga-esercizio__immagine">
          {selezionato?.immagine_url ? (
            <img src={selezionato.immagine_url} alt={selezionato.nome} />
          ) : (
            <span className="riga-esercizio__placeholder">🏋️</span>
          )}
        </div>

        <div className="riga-esercizio__campi">
          <select
            value={esercizio.esercizio_id}
            onChange={(e) => onChange({ esercizio_id: e.target.value })}
            required
          >
            <option value="" disabled>
              Scegli esercizio…
            </option>
            {catalogo.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="riga-esercizio__rimuovi" onClick={onRemove} aria-label="Rimuovi esercizio">
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
              onChange={(e) => aggiornaSerie(i, { ripetizioni: e.target.value })}
            />
            <input
              type="number"
              step="0.5"
              placeholder="Kg"
              value={s.peso_kg}
              onChange={(e) => aggiornaSerie(i, { peso_kg: e.target.value })}
            />
            <button
              type="button"
              className="riga-serie__rimuovi"
              onClick={() => rimuoviSerie(i)}
              aria-label="Rimuovi serie"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="btn btn--testo btn--piccolo" onClick={aggiungiSerie}>
          + Serie
        </button>
      </div>
    </div>
  );
}
