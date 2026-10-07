-- Rende il catalogo esercizi separato per utente (prima era condiviso, unica
-- tabella dati senza utente_id). Le righe esistenti vengono assegnate
-- all'unico utente presente oggi, cosi' il catalogo attuale non sparisce.
--
-- L'univocita' del nome era globale (indice "nome", creato implicitamente da
-- UNIQUE sulla colonna in schema.sql) — diventa per-utente: due persone
-- possono avere entrambe un esercizio chiamato "Panca piana".

ALTER TABLE esercizi ADD COLUMN utente_id INT NULL AFTER id;

UPDATE esercizi SET utente_id = (SELECT id FROM utente ORDER BY id ASC LIMIT 1);

ALTER TABLE esercizi MODIFY utente_id INT NOT NULL;
ALTER TABLE esercizi ADD CONSTRAINT fk_esercizi_utente FOREIGN KEY (utente_id) REFERENCES utente(id) ON DELETE CASCADE;

ALTER TABLE esercizi DROP INDEX nome;
ALTER TABLE esercizi ADD UNIQUE KEY uniq_esercizi_utente_nome (utente_id, nome);
