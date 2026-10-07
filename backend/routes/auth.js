const express = require('express');
const jwt = require('jsonwebtoken');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const { isoUint8Array, isoBase64URL } = require('@simplewebauthn/server/helpers');
const pool = require('../db');
const requireAuth = require('../middleware/requireAuth');
const challengeStore = require('../webauthnChallengeStore');

const router = express.Router();

const RP_ID = process.env.RP_ID;
const RP_NAME = process.env.RP_NAME;
const ORIGIN = process.env.ORIGIN;

function issueSessionCookie(res, utenteId) {
  const token = jwt.sign({ utenteId }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

// true se esiste almeno un utente con almeno una passkey — usato solo dal
// frontend per decidere se mostrare "Accedi" come azione primaria (vedi
// GET /status). Non implica più "l'unico utente": con più persone configurate
// questa è solo una domanda sì/no, il login vero risale all'utente dalla
// credenziale usata (vedi /login-verify).
async function esisteAlmenoUnUtenteConfigurato() {
  const [rows] = await pool.query(
    `SELECT 1 FROM utente u
     WHERE EXISTS (SELECT 1 FROM credenziali_webauthn c WHERE c.utente_id = u.id)
     LIMIT 1`
  );
  return rows.length > 0;
}

async function getCredenzialiUtente(utenteId) {
  const [rows] = await pool.query(
    'SELECT * FROM credenziali_webauthn WHERE utente_id = ?',
    [utenteId]
  );
  return rows;
}

// registrationInfo di verifyRegistrationResponse (v10) ha campi piatti, non un oggetto "credential" annidato.
async function salvaCredenziale(utenteId, registrationInfo, transports, nomeDispositivo) {
  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    registrationInfo;
  await pool.query(
    `INSERT INTO credenziali_webauthn
      (utente_id, credential_id, public_key, counter, device_type, backed_up, transports, nome_dispositivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      utenteId,
      credentialID,
      isoBase64URL.fromBuffer(credentialPublicKey),
      counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      (transports || []).join(','),
      nomeDispositivo || null,
    ]
  );
}

// Stato generale: esiste almeno un utente configurato? (usato solo per la UI
// di Login, vedi commento sopra esisteAlmenoUnUtenteConfigurato)
router.get('/status', async (req, res) => {
  const configurato = await esisteAlmenoUnUtenteConfigurato();
  res.json({ hasUser: configurato, hasCredentials: configurato });
});

// --- Enrollment di un nuovo utente (protetto dal setup secret, ripetibile:
// non è più un'operazione "una volta sola nella vita dell'app" — chiunque
// conosca il secret può predisporre un nuovo utente, con lo stesso identico
// flusso del primo) ---

router.post('/setup/register-options', async (req, res) => {
  const { setupSecret, nome } = req.body;
  if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Setup secret non valido' });
  }
  // Sempre un nuovo utente: niente più riuso di una riga "incompleta" di un
  // tentativo precedente — con più persone quella logica diventerebbe
  // ambigua (di chi è la riga a metà?). Un tentativo di setup abbandonato a
  // metà lascia al più una riga utente orfana senza passkey, innocua.
  const [result] = await pool.query('INSERT INTO utente (nome) VALUES (?)', [nome || 'Utente']);
  const utenteId = result.insertId;

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: isoUint8Array.fromUTF8String(String(utenteId)),
    userName: nome || 'Utente',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  const attemptId = challengeStore.create({ challenge: options.challenge, utenteId });
  res.json({ ...options, attemptId });
});

router.post('/setup/register-verify', async (req, res) => {
  const { setupSecret, credential, nomeDispositivo, attemptId } = req.body;
  if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Setup secret non valido' });
  }
  const pending = challengeStore.get(attemptId);
  if (!pending) {
    return res.status(400).json({ error: 'Nessun enrollment in corso (o scaduto, riprova)' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  challengeStore.clear(attemptId);

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verifica registrazione fallita' });
  }

  await salvaCredenziale(
    pending.utenteId,
    verification.registrationInfo,
    credential.response.transports,
    nomeDispositivo
  );

  issueSessionCookie(res, pending.utenteId);
  res.json({ ok: true });
});

// --- Registrazione di una nuova passkey su un utente già autenticato (nuovo device) ---

router.post('/register-options', requireAuth, async (req, res) => {
  const credenzialiEsistenti = await getCredenzialiUtente(req.utenteId);
  const [utenteRows] = await pool.query('SELECT * FROM utente WHERE id = ?', [req.utenteId]);
  const utente = utenteRows[0];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: isoUint8Array.fromUTF8String(String(req.utenteId)),
    userName: utente.nome,
    attestationType: 'none',
    excludeCredentials: credenzialiEsistenti.map((c) => ({ id: c.credential_id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
  });

  const attemptId = challengeStore.create({ challenge: options.challenge, utenteId: req.utenteId });
  res.json({ ...options, attemptId });
});

router.post('/register-verify', requireAuth, async (req, res) => {
  const { credential, nomeDispositivo, attemptId } = req.body;
  const pending = challengeStore.get(attemptId);
  if (!pending || pending.utenteId !== req.utenteId) {
    return res.status(400).json({ error: 'Nessun enrollment in corso per questo utente' });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  challengeStore.clear(attemptId);

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verifica registrazione fallita' });
  }

  await salvaCredenziale(
    req.utenteId,
    verification.registrationInfo,
    credential.response.transports,
    nomeDispositivo
  );

  res.json({ ok: true });
});

// --- Login con passkey esistente (discoverable: non sappiamo ancora "di chi"
// è finché il dispositivo non la restituisce in verify) ---

router.post('/login-options', async (req, res) => {
  // Nessun allowCredentials: il dispositivo mostra tutte le passkey
  // registrate per questo sito (residentKey:'preferred' in fase di
  // registrazione le rende scopribili), la persona sceglie la propria —
  // è così che login-verify risale a quale utente è senza doverlo chiedere.
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
  });

  const attemptId = challengeStore.create({ challenge: options.challenge });
  res.json({ ...options, attemptId });
});

router.post('/login-verify', async (req, res) => {
  const { credential, attemptId } = req.body;
  const pending = challengeStore.get(attemptId);
  if (!pending) {
    return res.status(400).json({ error: 'Nessun login in corso (o scaduto, riprova)' });
  }

  // credential_id è univoco globalmente (schema.sql) — risale da solo
  // all'utente proprietario, senza doverlo già conoscere.
  const [rows] = await pool.query('SELECT * FROM credenziali_webauthn WHERE credential_id = ?', [
    credential.id,
  ]);
  const credenziale = rows[0];
  if (!credenziale) {
    return res.status(400).json({ error: 'Passkey sconosciuta' });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: credenziale.credential_id,
        credentialPublicKey: isoBase64URL.toBuffer(credenziale.public_key),
        counter: Number(credenziale.counter),
        transports: credenziale.transports ? credenziale.transports.split(',') : undefined,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  challengeStore.clear(attemptId);

  if (!verification.verified) {
    return res.status(400).json({ error: 'Verifica login fallita' });
  }

  await pool.query('UPDATE credenziali_webauthn SET counter = ? WHERE id = ?', [
    verification.authenticationInfo.newCounter,
    credenziale.id,
  ]);

  issueSessionCookie(res, credenziale.utente_id);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT id, nome, altezza_cm, data_nascita FROM utente WHERE id = ?', [
    req.utenteId,
  ]);
  res.json(rows[0] || null);
});

module.exports = router;
