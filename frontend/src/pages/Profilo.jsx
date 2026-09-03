import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext.jsx';

export default function Profilo() {
  const { logout, aggiungiPasskey } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: '', altezza_cm: '', data_nascita: '' });
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggio, setMessaggio] = useState('');

  useEffect(() => {
    (async () => {
      const p = await api.get('/profilo');
      if (p) {
        setForm({ nome: p.nome || '', altezza_cm: p.altezza_cm || '', data_nascita: p.data_nascita || '' });
      }
    })();
  }, []);

  async function salva(e) {
    e.preventDefault();
    setSalvataggio(true);
    setMessaggio('');
    try {
      await api.put('/profilo', form);
      setMessaggio('Profilo salvato.');
    } finally {
      setSalvataggio(false);
    }
  }

  async function nuovaPasskey() {
    setMessaggio('');
    try {
      const nomeDispositivo = window.prompt('Nome di questo dispositivo (es. "iPhone")') || undefined;
      await aggiungiPasskey(nomeDispositivo);
      setMessaggio('Passkey aggiunta a questo dispositivo.');
    } catch (err) {
      setMessaggio(err.message);
    }
  }

  async function esci() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="pagina">
      <h1>Profilo</h1>

      <form onSubmit={salva} className="form pannello">
        <label>
          Nome
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label>
          Altezza (cm)
          <input
            type="number"
            step="0.1"
            value={form.altezza_cm}
            onChange={(e) => setForm({ ...form, altezza_cm: e.target.value })}
          />
        </label>
        <label>
          Data di nascita
          <input
            type="date"
            value={form.data_nascita || ''}
            onChange={(e) => setForm({ ...form, data_nascita: e.target.value })}
          />
        </label>
        <button type="submit" className="btn btn--primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva'}
        </button>
      </form>

      {messaggio && <p className="testo-secondario">{messaggio}</p>}

      <div className="pannello">
        <h2>Sicurezza</h2>
        <button className="btn btn--secondario" onClick={nuovaPasskey}>
          + Registra passkey su questo dispositivo
        </button>
        <button className="btn btn--testo" onClick={esci}>
          Esci
        </button>
      </div>
    </div>
  );
}
