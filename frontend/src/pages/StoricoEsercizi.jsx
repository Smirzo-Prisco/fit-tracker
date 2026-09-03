import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';

export default function StoricoEsercizi() {
  const [nomi, setNomi] = useState([]);
  const [selezionato, setSelezionato] = useState(null);
  const [progressione, setProgressione] = useState([]);

  useEffect(() => {
    (async () => {
      const lista = await api.get('/allenamenti/nomi-esercizi');
      setNomi(lista);
      if (lista.length > 0) setSelezionato(lista[0].nome);
    })();
  }, []);

  useEffect(() => {
    if (!selezionato) return;
    (async () => {
      const dati = await api.get(`/allenamenti/progressione/${encodeURIComponent(selezionato)}`);
      setProgressione(
        dati
          .filter((d) => d.peso_kg != null)
          .map((d) => ({ data: d.data, peso: Number(d.peso_kg) }))
      );
    })();
  }, [selezionato]);

  return (
    <div className="pagina">
      <h1>Storico esercizi</h1>

      {nomi.length === 0 ? (
        <p className="testo-secondario">Registra un allenamento per vedere qui la progressione.</p>
      ) : (
        <>
          <div className="lista-esercizi-storico">
            {nomi.map((n) => (
              <button
                key={n.nome}
                className={`chip${selezionato === n.nome ? ' chip--attivo' : ''}`}
                onClick={() => setSelezionato(n.nome)}
              >
                {n.immagine_url && <img src={n.immagine_url} alt="" />}
                {n.nome} · {n.volte}x
              </button>
            ))}
          </div>

          <div className="pannello">
            <h2>{selezionato}</h2>
            {progressione.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={progressione}>
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Line type="monotone" dataKey="peso" stroke="#1e6feb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="testo-secondario">Servono almeno due sessioni con peso registrato per il grafico.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
