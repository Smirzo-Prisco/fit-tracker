// Applica le migrazioni SQL di backend/migrations/ non ancora eseguite, in
// ordine di nome (prefisso data). Lanciato dal workflow di deploy prima del
// riavvio di pm2, ma si può eseguire anche a mano: `node migrate.js`.
//
// Le migrazioni già applicate sono registrate nella tabella migrazioni_applicate.
// Quelle precedenti all'introduzione di questo script erano state lanciate a
// mano: alla prima esecuzione (tabella vuota) vengono solo segnate come fatte.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const CARTELLA = path.join(__dirname, 'migrations');
const PRIMA_MIGRAZIONE_AUTOMATICA = '2026_11_03_riposo_scheda_esercizi.sql';

// Errori MySQL che indicano "è già stato fatto" (es. installazione nuova da
// schema.sql che contiene già la colonna): la migrazione si segna come applicata.
const GIA_PRESENTE = new Set([
  1050, // ER_TABLE_EXISTS_ERROR
  1060, // ER_DUP_FIELDNAME
  1061, // ER_DUP_KEYNAME
]);

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS migrazioni_applicate (
         nome VARCHAR(255) PRIMARY KEY,
         applicata_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );

    const file = fs
      .readdirSync(CARTELLA)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const [righe] = await connection.query('SELECT nome FROM migrazioni_applicate');
    const applicate = new Set(righe.map((r) => r.nome));

    if (applicate.size === 0) {
      for (const nome of file.filter((f) => f < PRIMA_MIGRAZIONE_AUTOMATICA)) {
        await connection.query('INSERT INTO migrazioni_applicate (nome) VALUES (?)', [nome]);
        applicate.add(nome);
        console.log(`[migrate] ${nome}: già applicata a mano, registrata`);
      }
    }

    for (const nome of file) {
      if (applicate.has(nome)) continue;
      const sql = fs.readFileSync(path.join(CARTELLA, nome), 'utf8');
      try {
        await connection.query(sql);
        console.log(`[migrate] ${nome}: applicata`);
      } catch (err) {
        if (!GIA_PRESENTE.has(err.errno)) throw err;
        console.log(`[migrate] ${nome}: già presente nel DB (${err.code}), registrata`);
      }
      await connection.query('INSERT INTO migrazioni_applicate (nome) VALUES (?)', [nome]);
    }
    console.log('[migrate] database aggiornato');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[migrate] ERRORE:', err.message);
  process.exit(1);
});
