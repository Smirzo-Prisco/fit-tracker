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

async function getUtenteUnico() {
  const [rows] = await pool.query('SELECT * FROM utente LIMIT 1');
  return rows[0] || null;
}

async function getCredenzialiUtente(utenteId) {
  const [rows] = await pool.query(
    'SELECT * FROM credenziali_webauthn WHERE utente_id = ?',
    [utenteId]
  );
  return rows;
}

// Stato generale: esiste già l'utente unico e almeno una passkey?
router.get('/status', async (req, res) => {
  const utente = await getUtenteUnico();
  if (!utente) {
    return res.json({ hasUser: false, hasCredentials: false });
  }
  const credenziali = await getCredenzialiUtente(utente.id);
  res.json({ hasUser: true, hasCredentials: credenziali.length > 0 });
});

// --- Enrollment iniziale (nessun utente/passkey esistente ancora) ---

router.post('/setup/register-options', async (req, res) => {
  const { setupSecret, nome } = req.body;
  if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Setup secret non valido' });
  }
  const utenteEsistente = await getUtenteUnico();
  if (utenteEsistente) {
    return res.status(409).json({ error: 'Utente già configurato, usa /register-options autenticato' });
  }

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

  challengeStore.set({ challenge: options.challenge, utenteId });
  res.json(options);
});

router.post('/setup/register-verify', async (req, res) => {
  const { setupSecret, credential, nomeDispositivo } = req.body;
  if (!setupSecret || setupSecret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Setup secret non valido' });
  }
  const pending = challengeStore.get();
  if (!pending) {
    return res.status(400).json({ error: 'Nessun enrollment in corso' });
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
  challengeStore.clear();

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verifica registrazione fallita' });
  }

  const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await pool.query(
    `INSERT INTO credenziali_webauthn
      (utente_id, credential_id, public_key, counter, device_type, backed_up, transports, nome_dispositivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      pending.utenteId,
      cred.id,
      isoBase64URL.fromBuffer(cred.publicKey),
      cred.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      (cred.transports || []).join(','),
      nomeDispositivo || null,
    ]
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

  challengeStore.set({ challenge: options.challenge, utenteId: req.utenteId });
  res.json(options);
});

router.post('/register-verify', requireAuth, async (req, res) => {
  const { credential, nomeDispositivo } = req.body;
  const pending = challengeStore.get();
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
  challengeStore.clear();

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'Verifica registrazione fallita' });
  }

  const { credential: cred, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await pool.query(
    `INSERT INTO credenziali_webauthn
      (utente_id, credential_id, public_key, counter, device_type, backed_up, transports, nome_dispositivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.utenteId,
      cred.id,
      isoBase64URL.fromBuffer(cred.publicKey),
      cred.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      (cred.transports || []).join(','),
      nomeDispositivo || null,
    ]
  );

  res.json({ ok: true });
});

// --- Login con passkey esistente ---

router.post('/login-options', async (req, res) => {
  const utente = await getUtenteUnico();
  if (!utente) {
    return res.status(404).json({ error: 'Nessun utente configurato' });
  }
  const credenziali = await getCredenzialiUtente(utente.id);
  if (credenziali.length === 0) {
    return res.status(404).json({ error: 'Nessuna passkey registrata' });
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    allowCredentials: credenziali.map((c) => ({
      id: c.credential_id,
      transports: c.transports ? c.transports.split(',') : undefined,
    })),
  });

  challengeStore.set({ challenge: options.challenge, utenteId: utente.id });
  res.json(options);
});

router.post('/login-verify', async (req, res) => {
  const { credential } = req.body;
  const pending = challengeStore.get();
  if (!pending) {
    return res.status(400).json({ error: 'Nessun login in corso' });
  }

  const [rows] = await pool.query(
    'SELECT * FROM credenziali_webauthn WHERE credential_id = ? AND utente_id = ?',
    [credential.id, pending.utenteId]
  );
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
      credential: {
        id: credenziale.credential_id,
        publicKey: isoBase64URL.toBuffer(credenziale.public_key),
        counter: Number(credenziale.counter),
        transports: credenziale.transports ? credenziale.transports.split(',') : undefined,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  challengeStore.clear();

  if (!verification.verified) {
    return res.status(400).json({ error: 'Verifica login fallita' });
  }

  await pool.query('UPDATE credenziali_webauthn SET counter = ? WHERE id = ?', [
    verification.authenticationInfo.newCounter,
    credenziale.id,
  ]);

  issueSessionCookie(res, pending.utenteId);
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
