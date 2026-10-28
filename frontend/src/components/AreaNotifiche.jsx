import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formattaDataOra } from '../lib/date';
import { abilitaPush, pushSupportato } from '../lib/push';

export default function AreaNotifiche() {
  const [notifiche, setNotifiche] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [pushAttiva, setPushAttiva] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [messaggio, setMessaggio] = useState('');

  useEffect(() => {
    api.get('/notifiche').then((n) => {
      setNotifiche(n);
      setCaricamento(false);
    });
  }, []);

  async function segnaLetta(id) {
    setNotifiche((prev) => prev.map((n) => (n.id === id ? { ...n, letta: true } : n)));
    await api.post(`/notifiche/${id}/letta`, {});
  }

  async function attivaPush() {
    setMessaggio('');
    try {
      await abilitaPush();
      setPushAttiva(true);
      setMessaggio('Notifiche attivate su questo dispositivo.');
    } catch (err) {
      setMessaggio(err.message);
    }
  }

  return (
    <div className="pannello">
      <div className="pannello__header">
        <h2>Notifiche</h2>
      </div>

      {pushSupportato() && !pushAttiva && (
        <>
          <button type="button" className="btn btn--secondario" onClick={attivaPush}>
            Attiva notifiche su questo dispositivo
          </button>
          {messaggio && <p className="testo-secondario">{messaggio}</p>}
        </>
      )}

      {caricamento ? (
        <p className="testo-secondario">Caricamento…</p>
      ) : notifiche.length === 0 ? (
        <p className="testo-secondario">Nessuna notifica.</p>
      ) : (
        <ul className="lista-notifiche">
          {notifiche.map((n) => (
            <li
              key={n.id}
              className={`notifica${n.letta ? '' : ' notifica--non-letta'}`}
              onClick={() => !n.letta && segnaLetta(n.id)}
            >
              <div className="notifica__header">
                <strong>{n.titolo}</strong>
                {!n.letta && <span className="pallino-placeholder" />}
              </div>
              {n.corpo && <p>{n.corpo}</p>}
              <span className="testo-secondario">{formattaDataOra(n.creato_il)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
