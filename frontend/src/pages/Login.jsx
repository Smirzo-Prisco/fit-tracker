import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function Login() {
  const { status, utente, login, setup, loading } = useAuth();
  const [nome, setNome] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [errore, setErrore] = useState('');
  const [inCorso, setInCorso] = useState(false);
  // Mostra il form di setup di default solo se non esiste ancora nessuno —
  // altrimenti è un'azione secondaria dietro un link ("Aggiungi un nuovo
  // utente"), raggiungibile in ogni momento con lo stesso identico flusso.
  const [mostraSetup, setMostraSetup] = useState(false);

  if (loading) return <div className="loading-schermo">Caricamento…</div>;
  if (utente) return <Navigate to="/" replace />;

  const nessunoConfigurato = status && !status.hasUser;
  const mostraFormSetup = nessunoConfigurato || mostraSetup;

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

        {mostraFormSetup ? (
          <form onSubmit={gestisciSetup} className="form">
            <p className="testo-secondario">
              {nessunoConfigurato
                ? "Prima configurazione: crea il tuo profilo e registra l'impronta/Face ID di questo dispositivo."
                : "Nuovo utente: crea il profilo e registra l'impronta/Face ID di questo dispositivo — i dati restano separati dagli altri utenti già configurati."}
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
            {!nessunoConfigurato && (
              <button type="button" className="btn btn--testo" onClick={() => setMostraSetup(false)}>
                Annulla, torna al login
              </button>
            )}
          </form>
        ) : (
          <div className="form">
            <p className="testo-secondario">Accedi con l'impronta o il Face ID di questo dispositivo.</p>
            <button className="btn btn--primario" onClick={gestisciLogin} disabled={inCorso}>
              {inCorso ? 'Verifica…' : 'Accedi'}
            </button>
            <button type="button" className="btn btn--testo" onClick={() => setMostraSetup(true)}>
              Aggiungi un nuovo utente
            </button>
          </div>
        )}

        {errore && <p className="messaggio-errore">{errore}</p>}
      </div>
    </div>
  );
}
