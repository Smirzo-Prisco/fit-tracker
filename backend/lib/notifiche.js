const { webpush, configurato } = require('./webpush');

// Unico punto di verità per creare una notifica e il suo fan-out: usato sia
// da routes/notifiche.js (pubblicazione admin) sia da routes/auth.js (avviso
// di nuova registrazione agli admin), per non duplicare la logica.
async function creaNotifica(pool, { tipo, titolo, corpo, creatoDa, destinatariIds }) {
  if (destinatariIds.length === 0) return null;

  const [result] = await pool.query(
    'INSERT INTO notifiche (tipo, titolo, corpo, creato_da) VALUES (?, ?, ?, ?)',
    [tipo, titolo, corpo, creatoDa || null]
  );
  const notificaId = result.insertId;

  await pool.query(
    `INSERT INTO notifiche_destinatari (notifica_id, utente_id) VALUES ${destinatariIds
      .map(() => '(?, ?)')
      .join(', ')}`,
    destinatariIds.flatMap((utenteId) => [notificaId, utenteId])
  );

  return notificaId;
}

// Invia la push a tutte le sottoscrizioni dei destinatari. Una sottoscrizione
// scaduta/revocata risponde 404 o 410: va rimossa, altrimenti continueremmo a
// tentare invii destinati a cadere per sempre.
async function inviaPush(pool, destinatariIds, payload) {
  if (!configurato || destinatariIds.length === 0) return;

  const [subs] = await pool.query(
    `SELECT * FROM push_subscriptions WHERE utente_id IN (${destinatariIds.map(() => '?').join(', ')})`,
    destinatariIds
  );

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.error('Invio push fallito:', err.message);
        }
      }
    })
  );
}

module.exports = { creaNotifica, inviaPush };
