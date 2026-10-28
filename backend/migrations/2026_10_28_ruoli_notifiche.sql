-- Apre l'app a più persone: ruoli (tu resti admin, chi si registra da solo
-- diventa 'user' per via del DEFAULT) + le tabelle per le notifiche push
-- (aggiornamenti dell'app, nuove registrazioni) e le sottoscrizioni push dei
-- singoli dispositivi.

ALTER TABLE utente ADD COLUMN ruolo ENUM('admin', 'user') NOT NULL DEFAULT 'user' AFTER nome;

-- Oggi esiste un solo utente: diventa admin. Chi si registra dopo resta
-- 'user' senza bisogno di altra logica, grazie al DEFAULT sopra.
UPDATE utente SET ruolo = 'admin' ORDER BY id ASC LIMIT 1;

-- Il contenuto di una notifica. "tipo" distingue un aggiornamento pubblicato
-- dall'admin da un avviso di nuova registrazione (quest'ultimo va solo agli
-- admin, vedi notifiche_destinatari).
CREATE TABLE IF NOT EXISTS notifiche (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tipo ENUM('aggiornamento', 'nuovo_utente') NOT NULL,
  titolo VARCHAR(200) NOT NULL,
  corpo TEXT,
  creato_da INT NULL,
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creato_da) REFERENCES utente(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fan-out per destinatario: una notifica "aggiornamento" ha una riga qui per
-- OGNI utente (admin incluso); una "nuovo_utente" ha una riga solo per gli
-- admin. letta_il resta NULL finché il destinatario non la apre.
CREATE TABLE IF NOT EXISTS notifiche_destinatari (
  notifica_id INT NOT NULL,
  utente_id INT NOT NULL,
  letta_il DATETIME NULL,
  PRIMARY KEY (notifica_id, utente_id),
  FOREIGN KEY (notifica_id) REFERENCES notifiche(id) ON DELETE CASCADE,
  FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Una riga per device/browser sottoscritto alle push — indipendente dalle
-- passkey: lo stesso utente può avere più dispositivi, ciascuno con la
-- propria sottoscrizione.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  utente_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_push_subscriptions_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
