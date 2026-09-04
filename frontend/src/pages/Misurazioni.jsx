import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';

const CIRCONFERENZE = [
  { chiave: 'braccio_cm', etichetta: 'Braccio' },
  { chiave: 'torace_cm', etichetta: 'Torace' },
  { chiave: 'vita_cm', etichetta: 'Vita' },
  { chiave: 'fianchi_cm', etichetta: 'Fianchi' },
  { chiave: 'coscia_cm', etichetta: 'Coscia' },
  { chiave: 'polpaccio_cm', etichetta: 'Polpaccio' },
];

const VUOTO = {
  data: new Date().toISOString().slice(0, 10),
  peso_kg: '',
  braccio_cm: '',
  torace_cm: '',
  vita_cm: '',
  fianchi_cm: '',
  coscia_cm: '',
  polpaccio_cm: '',
  note: '',
};

export default function Misurazioni() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(VUOTO);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');
  const [campoGrafico, setCampoGrafico] = useState('peso_kg');

  async function ricarica() {
    const m = await api.get('/misurazioni');
    setLista(m);
  }

  useEffect(() => {
    ricarica();
  }, []);

  async function invia(e) {
    e.preventDefault();
    setErrore('');
    setSalvataggio(true);
    try {
      await api.post('/misurazioni', form);
      setForm(VUOTO);
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  async function elimina(id) {
    await api.del(`/misurazioni/${id}`);
    await ricarica();
  }

  const datiGrafico = useMemo(
    () =>
      [...lista]
        .filter((m) => m[campoGrafico] != null)
        .reverse()
        .map((m) => ({ data: formattaData(m.data), valore: Number(m[campoGrafico]) })),
    [lista, campoGrafico]
  );

  return (
    <div className="pagina">
      <h1>Misurazioni</h1>

      <form onSubmit={invia} className="form pannello">
        <label>
          Data
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.target.value })}
            required
          />
        </label>
        <label>
          Peso (kg)
          <input
            type="number"
            step="0.1"
            value={form.peso_kg}
            onChange={(e) => setForm({ ...form, peso_kg: e.target.value })}
          />
        </label>

        <div className="griglia-campi">
          {CIRCONFERENZE.map((c) => (
            <label key={c.chiave}>
              {c.etichetta} (cm)
              <input
                type="number"
                step="0.1"
                value={form[c.chiave]}
                onChange={(e) => setForm({ ...form, [c.chiave]: e.target.value })}
              />
            </label>
          ))}
        </div>

        <label>
          Note
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            rows={2}
          />
        </label>

        {errore && <p className="messaggio-errore">{errore}</p>}
        <button type="submit" className="btn btn--primario" disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva misurazione'}
        </button>
      </form>

      <div className="pannello">
        <div className="pannello__header">
          <h2>Andamento</h2>
          <select value={campoGrafico} onChange={(e) => setCampoGrafico(e.target.value)}>
            <option value="peso_kg">Peso</option>
            {CIRCONFERENZE.map((c) => (
              <option key={c.chiave} value={c.chiave}>
                {c.etichetta}
              </option>
            ))}
          </select>
        </div>
        {datiGrafico.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={datiGrafico}>
              <XAxis dataKey="data" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="valore" stroke="#1e6feb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="testo-secondario">Servono almeno due misurazioni per il grafico.</p>
        )}
      </div>

      <div className="pannello">
        <h2>Storico</h2>
        <ul className="lista-misurazioni">
          {lista.map((m) => (
            <li key={m.id} className="lista-misurazioni__riga">
              <div>
                <strong>{formattaData(m.data)}</strong>
                <span className="testo-secondario">
                  {m.peso_kg ? ` · ${m.peso_kg} kg` : ''}
                </span>
              </div>
              <button className="btn btn--testo" onClick={() => elimina(m.id)}>
                Elimina
              </button>
            </li>
          ))}
          {lista.length === 0 && <p className="testo-secondario">Nessuna misurazione ancora.</p>}
        </ul>
      </div>
    </div>
  );
}
