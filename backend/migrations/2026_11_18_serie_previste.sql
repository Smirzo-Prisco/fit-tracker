-- Numero di serie che l'utente vuole per un esercizio in QUESTO allenamento, quando
-- l'ha cambiato a mano (aggiunta/rimozione di una serie). Serve a non ricreare,
-- riaprendo l'allenamento, le righe placeholder dello storico che aveva rimosso:
-- quelle righe non sono mai salvate, quindi senza questo dato ricomparirebbero.
-- NULL = mai toccato, si propongono tante serie quante l'ultima volta.
ALTER TABLE allenamento_esercizi ADD COLUMN serie_previste INT NULL AFTER ordine;
