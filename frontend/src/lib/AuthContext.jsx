import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(null); // { hasUser, hasCredentials }
  const [utente, setUtente] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    const s = await api.get('/auth/status');
    setStatus(s);
    return s;
  }, []);

  const refreshUtente = useCallback(async () => {
    try {
      const u = await api.get('/auth/me');
      setUtente(u);
    } catch {
      setUtente(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshStatus();
      await refreshUtente();
      setLoading(false);
    })();
  }, [refreshStatus, refreshUtente]);

  const setup = useCallback(
    async (nome, setupSecret) => {
      const options = await api.post('/auth/setup/register-options', { setupSecret, nome });
      const credential = await startRegistration(options);
      await api.post('/auth/setup/register-verify', { setupSecret, credential });
      await refreshStatus();
      await refreshUtente();
    },
    [refreshStatus, refreshUtente]
  );

  const aggiungiPasskey = useCallback(
    async (nomeDispositivo) => {
      const options = await api.post('/auth/register-options', {});
      const credential = await startRegistration(options);
      await api.post('/auth/register-verify', { credential, nomeDispositivo });
    },
    []
  );

  const login = useCallback(async () => {
    const options = await api.post('/auth/login-options', {});
    const credential = await startAuthentication(options);
    await api.post('/auth/login-verify', { credential });
    await refreshUtente();
  }, [refreshUtente]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout', {});
    setUtente(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, utente, loading, setup, login, logout, aggiungiPasskey, refreshUtente }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
