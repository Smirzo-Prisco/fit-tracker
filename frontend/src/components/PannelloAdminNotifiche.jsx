import { useState } from 'react';
import { api } from '../lib/api';

export default function PannelloAdminNotifiche() {
  const [titolo, setTitolo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState('');

  async function pubblica(e) {
    e.preventDefault();
    setInCorso(true);
    setMessaggio('');
    try {
      await api.post('/notifiche/pubblica', { titolo, corpo });
      setTitolo('');
      setCorpo('');
      setMessaggio('Notifica pubblicata a tutti gli utenti.');
    } catch (err) {
      setMessaggio(err.message);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="pannello">
      <h2>Pubblica aggiornamento</h2>
      <p className="testo-secondario">Arriva come notifica push a tutti gli utenti, te incluso.</p>
      <form onSubmit={pubblica} className="form">
        <label>
          Titolo
          <input value={titolo} onChange={(e) => setTitolo(e.target.value)} required />
        </label>
        <label>
          Testo
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={3} />
        </label>
        <button type="submit" className="btn btn--primario" disabled={inCorso}>
          {inCorso ? 'Pubblicazione…' : 'Pubblica'}
        </button>
      </form>
      {messaggio && <p className="testo-secondario">{messaggio}</p>}
    </div>
  );
}
