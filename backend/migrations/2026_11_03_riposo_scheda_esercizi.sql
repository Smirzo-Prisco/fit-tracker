-- Minuti di riposo consigliati tra le serie, per esercizio e per scheda (come
-- serie/ripetizioni consigliate). DECIMAL per consentire valori tipo 1.5 min.
ALTER TABLE scheda_esercizi ADD COLUMN riposo_min DECIMAL(4,1) NULL AFTER ripetizioni_consigliate;
