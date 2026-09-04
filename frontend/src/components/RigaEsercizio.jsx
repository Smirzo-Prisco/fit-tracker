export default function RigaEsercizio({ esercizio, catalogo, onChange, onRemove }) {
  const selezionato = catalogo.find((e) => String(e.id) === String(esercizio.esercizio_id));

  return (
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

        <div className="riga-esercizio__numeri">
          <input
            type="number"
            placeholder="Serie"
            value={esercizio.serie}
            onChange={(e) => onChange({ serie: e.target.value })}
          />
          <input
            type="number"
            placeholder="Rip."
            value={esercizio.ripetizioni}
            onChange={(e) => onChange({ ripetizioni: e.target.value })}
          />
          <input
            type="number"
            step="0.5"
            placeholder="Kg"
            value={esercizio.peso_kg}
            onChange={(e) => onChange({ peso_kg: e.target.value })}
          />
        </div>
      </div>

      <button type="button" className="riga-esercizio__rimuovi" onClick={onRemove} aria-label="Rimuovi esercizio">
        ✕
      </button>
    </div>
  );
}
