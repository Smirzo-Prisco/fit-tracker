require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const profiloRoutes = require('./routes/profilo');
const misurazioniRoutes = require('./routes/misurazioni');
const allenamentiRoutes = require('./routes/allenamenti');
const eserciziRoutes = require('./routes/esercizi');
const schedeRoutes = require('./routes/schede');

const app = express();

app.use(cors({ origin: process.env.ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/profilo', profiloRoutes);
app.use('/api/misurazioni', misurazioniRoutes);
app.use('/api/allenamenti', allenamentiRoutes);
app.use('/api/esercizi', eserciziRoutes);
app.use('/api/schede', schedeRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Errore interno' });
});

const port = process.env.PORT || 4001;
app.listen(port, '127.0.0.1', () => {
  console.log(`Fit Tracker API in ascolto su 127.0.0.1:${port}`);
});
