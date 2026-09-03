import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Misurazioni from './pages/Misurazioni.jsx';
import Allenamenti from './pages/Allenamenti.jsx';
import NuovoAllenamento from './pages/NuovoAllenamento.jsx';
import StoricoEsercizi from './pages/StoricoEsercizi.jsx';
import Profilo from './pages/Profilo.jsx';

function RottaProtetta({ children }) {
  const { utente, loading } = useAuth();
  if (loading) return <div className="loading-schermo">Caricamento…</div>;
  if (!utente) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RottaProtetta>
            <Layout />
          </RottaProtetta>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="misurazioni" element={<Misurazioni />} />
        <Route path="allenamenti" element={<Allenamenti />} />
        <Route path="allenamenti/nuovo" element={<NuovoAllenamento />} />
        <Route path="allenamenti/:id/modifica" element={<NuovoAllenamento />} />
        <Route path="esercizi" element={<StoricoEsercizi />} />
        <Route path="profilo" element={<Profilo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
