import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api';

export default function RigaEsercizio({ esercizio, onChange, onRemove }) {
  const [suggerimenti, setSuggerimenti] = useState([]);
  const [caricamentoImmagine, setCaricamentoImmagine] = useState(false);
  const datalistId = useId();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const nome = esercizio.nome.trim();
    if (nome.length < 2) {
      setSuggerimenti([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        const risultati = await api.get(`/allenamenti/suggerimenti-esercizi?q=${encodeURIComponent(nome)}`);
        setSuggerimenti(risultati);
      } catch {
        // autocomplete opzionale, ignora errori di rete
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [esercizio.nome]);

  function gestisciNome(valore) {
    const match = suggerimenti.find((s) => s.nome.toLowerCase() === valore.toLowerCase());
    if (match && !esercizio.immagine_url) {
      onChange({ nome: valore, immagine_url: match.immagine_url });
    } else {
      onChange({ nome: valore });
    }
  }

  async function gestisciFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCaricamentoImmagine(true);
    try {
      const formData = new FormData();
      formData.append('immagine', file);
      const risultato = await api.post('/allenamenti/upload-immagine', formData);
      onChange({ immagine_url: risultato.immagine_url });
    } finally {
      setCaricamentoImmagine(false);
    }
  }

  return (
    <div className="riga-esercizio">
      <div className="riga-esercizio__immagine" onClick={() => fileInputRef.current?.click()}>
        {esercizio.immagine_url ? (
          <img src={esercizio.immagine_url} alt={esercizio.nome || 'esercizio'} />
        ) : (
          <span className="riga-esercizio__placeholder">📷</span>
        )}
        {caricamentoImmagine && <span className="riga-esercizio__caricamento">…</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={gestisciFile}
        />
      </div>

      <div className="riga-esercizio__campi">
        <input
          list={datalistId}
          placeholder="Nome esercizio"
          value={esercizio.nome}
          onChange={(e) => gestisciNome(e.target.value)}
          required
        />
        <datalist id={datalistId}>
          {suggerimenti.map((s) => (
            <option key={s.nome} value={s.nome} />
          ))}
        </datalist>

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
