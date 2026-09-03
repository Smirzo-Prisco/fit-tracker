import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function Login() {
  const { status, utente, login, setup, loading } = useAuth();
  const [nome, setNome] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);

  if (loading) return <div className="loading-schermo">Caricamento…</div>;
  if (utente) return <Navigate to="/" replace />;

  const necessitaSetup = status && (!status.hasUser || !status.hasCredentials);

  async function gestisciSetup(e) {
    e.preventDefault();
    setErrore('');
    setInCorso(true);
    try {
      await setup(nome, setupSecret);
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(false);
    }
  }

  async function gestisciLogin() {
    setErrore('');
    setInCorso(true);
    try {
      await login();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="pagina-login">
      <div className="pagina-login__card">
        <h1>Fit Tracker</h1>

        {necessitaSetup ? (
          <form onSubmit={gestisciSetup} className="form">
            <p className="testo-secondario">
              Prima configurazione: crea il tuo profilo e registra l'impronta/Face ID di questo dispositivo.
            </p>
            <label>
              Il tuo nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </label>
            <label>
              Setup secret
              <input
                type="password"
                value={setupSecret}
                onChange={(e) => setSetupSecret(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn--primario" disabled={inCorso}>
              {inCorso ? 'Registrazione…' : 'Registra la mia impronta'}
            </button>
          </form>
        ) : (
          <div className="form">
            <p className="testo-secondario">Accedi con l'impronta o il Face ID di questo dispositivo.</p>
            <button className="btn btn--primario" onClick={gestisciLogin} disabled={inCorso}>
              {inCorso ? 'Verifica…' : 'Accedi'}
            </button>
          </div>
        )}

        {errore && <p className="messaggio-errore">{errore}</p>}
      </div>
    </div>
  );
}
