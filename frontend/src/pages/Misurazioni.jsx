import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';
import { formattaData } from '../lib/date';
import { CIRCONFERENZE } from '../lib/misurazioni';

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
  const [idInModifica, setIdInModifica] = useState(null);
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
      if (idInModifica) {
        await api.put(`/misurazioni/${idInModifica}`, form);
      } else {
        await api.post('/misurazioni', form);
      }
      setForm(VUOTO);
      setIdInModifica(null);
      await ricarica();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setSalvataggio(false);
    }
  }

  function modifica(m) {
    setForm({
      data: m.data,
      peso_kg: m.peso_kg ?? '',
      braccio_cm: m.braccio_cm ?? '',
      torace_cm: m.torace_cm ?? '',
      vita_cm: m.vita_cm ?? '',
      fianchi_cm: m.fianchi_cm ?? '',
      coscia_cm: m.coscia_cm ?? '',
      polpaccio_cm: m.polpaccio_cm ?? '',
      note: m.note ?? '',
    });
    setIdInModifica(m.id);
    setErrore('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function annullaModifica() {
    setForm(VUOTO);
    setIdInModifica(null);
    setErrore('');
  }

  async function elimina(id) {
    await api.del(`/misurazioni/${id}`);
    if (id === idInModifica) annullaModifica();
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
        <h2>{idInModifica ? 'Modifica misurazione' : 'Nuova misurazione'}</h2>
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
        <div className="form__azioni">
          <button type="submit" className="btn btn--primario" disabled={salvataggio}>
            {salvataggio ? 'Salvataggio…' : idInModifica ? 'Salva modifiche' : 'Salva misurazione'}
          </button>
          {idInModifica && (
            <button type="button" className="btn btn--testo" onClick={annullaModifica} disabled={salvataggio}>
              Annulla
            </button>
          )}
        </div>
      </form>

      <div className="pannello">
        <div className="pannello__header">
          <h2>Andamento</h2>
        </div>
        <div className="filtri-gruppo">
          <button
            type="button"
            className={`filtro-gruppo${campoGrafico === 'peso_kg' ? ' filtro-gruppo--attivo' : ''}`}
            onClick={() => setCampoGrafico('peso_kg')}
          >
            Peso
          </button>
          {CIRCONFERENZE.map((c) => (
            <button
              key={c.chiave}
              type="button"
              className={`filtro-gruppo${campoGrafico === c.chiave ? ' filtro-gruppo--attivo' : ''}`}
              onClick={() => setCampoGrafico(c.chiave)}
            >
              {c.etichetta}
            </button>
          ))}
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
              <div className="lista-misurazioni__azioni">
                <button className="btn btn--testo" onClick={() => modifica(m)}>
                  Modifica
                </button>
                <button className="btn btn--testo" onClick={() => elimina(m.id)}>
                  Elimina
                </button>
              </div>
            </li>
          ))}
          {lista.length === 0 && <p className="testo-secondario">Nessuna misurazione ancora.</p>}
        </ul>
      </div>
    </div>
  );
}
