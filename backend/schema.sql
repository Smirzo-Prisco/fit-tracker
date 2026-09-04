CREATE TABLE IF NOT EXISTS utente (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  altezza_cm DECIMAL(5,1),
  data_nascita DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS credenziali_webauthn (
  id INT PRIMARY KEY AUTO_INCREMENT,
  utente_id INT NOT NULL,
  credential_id VARCHAR(255) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type VARCHAR(32),
  backed_up TINYINT(1) NOT NULL DEFAULT 0,
  transports VARCHAR(255),
  nome_dispositivo VARCHAR(100),
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS misurazioni (
  id INT PRIMARY KEY AUTO_INCREMENT,
  utente_id INT NOT NULL,
  data DATE NOT NULL,
  peso_kg DECIMAL(5,2),
  braccio_cm DECIMAL(5,1),
  torace_cm DECIMAL(5,1),
  vita_cm DECIMAL(5,1),
  fianchi_cm DECIMAL(5,1),
  coscia_cm DECIMAL(5,1),
  polpaccio_cm DECIMAL(5,1),
  note TEXT,
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE,
  INDEX idx_misurazioni_utente_data (utente_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS allenamenti (
  id INT PRIMARY KEY AUTO_INCREMENT,
  utente_id INT NOT NULL,
  data DATE NOT NULL,
  durata_min INT,
  note TEXT,
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE,
  INDEX idx_allenamenti_utente_data (utente_id, data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS esercizi (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL UNIQUE,
  immagine_url VARCHAR(255),
  gruppo_muscolare VARCHAR(100),
  creato_il DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS allenamento_esercizi (
  id INT PRIMARY KEY AUTO_INCREMENT,
  allenamento_id INT NOT NULL,
  esercizio_id INT NOT NULL,
  serie INT,
  ripetizioni INT,
  peso_kg DECIMAL(6,2),
  ordine INT NOT NULL DEFAULT 0,
  FOREIGN KEY (allenamento_id) REFERENCES allenamenti(id) ON DELETE CASCADE,
  FOREIGN KEY (esercizio_id) REFERENCES esercizi(id) ON DELETE RESTRICT,
  INDEX idx_allenamento_esercizi_esercizio (esercizio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
