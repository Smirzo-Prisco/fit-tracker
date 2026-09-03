# Fit Tracker

App personale per monitorare peso, circonferenze corporee (braccio, torace, vita, fianchi, coscia, polpaccio) e allenamenti (esercizi, serie, ripetizioni, pesi). PWA mobile-first, login con passkey (impronta/Face ID) via WebAuthn.

## Stack

- **Backend**: Node.js + Express + MySQL (`mysql2`), auth WebAuthn (`@simplewebauthn/server`)
- **Frontend**: React + Vite, PWA (`vite-plugin-pwa`), grafici con `recharts`

## Sviluppo locale

```bash
# Backend
cd backend
cp .env.example .env   # compila DB_*, JWT_SECRET, SETUP_SECRET
npm install
mysql -u root -p < schema.sql   # su un DB "fit_tracker" già creato
npm start                        # http://127.0.0.1:4001

# Frontend (altro terminale)
cd frontend
npm install
npm run dev                      # http://localhost:5173, proxy /api verso il backend
```

In sviluppo WebAuthn richiede `localhost` (accettato dai browser come "contesto sicuro" anche senza HTTPS) — non funziona su `http://<ip-lan>` da smartphone in rete locale, solo in produzione via HTTPS.

### Primo accesso

Alla prima apertura l'app mostra il form di **setup**: nome + `SETUP_SECRET` (quello messo in `.env`), poi richiede di registrare la passkey del dispositivo. Da lì in poi si accede con "Accedi" (impronta/Face ID). Per aggiungere altri dispositivi, dalla pagina Profilo → "Registra passkey su questo dispositivo" (richiede di essere già loggati su un device).

## Provisioning sulla VPS (una tantum)

1. **DNS**: record A `fit.crystaltokyo.it` → IP della VPS (dal proprio provider DNS)
2. **MySQL**:
   ```sql
   CREATE DATABASE fit_tracker CHARACTER SET utf8mb4;
   CREATE USER 'fit_tracker'@'localhost' IDENTIFIED BY '<password>';
   GRANT ALL PRIVILEGES ON fit_tracker.* TO 'fit_tracker'@'localhost';
   ```
   poi `mysql -u fit_tracker -p fit_tracker < backend/schema.sql`
3. **Clone repo** in `/var/www/fit-crystaltokyo/`, creare `backend/.env` (da `.env.example`, con `RP_ID`/`ORIGIN` = `fit.crystaltokyo.it`/`https://fit.crystaltokyo.it`)
4. **pm2**: `cd backend && npm install --production && pm2 start server.js --name fit-api && pm2 save`
5. **nginx** — nuovo file `/etc/nginx/sites-available/fit.crystaltokyo.it`:
   ```nginx
   server {
       listen 80;
       server_name fit.crystaltokyo.it;

       root /var/www/fit-crystaltokyo/frontend/dist;
       index index.html;

       location /api/ {
           proxy_pass http://127.0.0.1:4001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /uploads/ {
           proxy_pass http://127.0.0.1:4001;
       }

       location / {
           try_files $uri /index.html;
       }
   }
   ```
   `ln -s /etc/nginx/sites-available/fit.crystaltokyo.it /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx`
6. **SSL**: `certbot --nginx -d fit.crystaltokyo.it` (obbligatorio: WebAuthn richiede HTTPS)
7. **Build iniziale frontend**: `cd frontend && npm install && npm run build`

## Deploy continuo

Push su `main` → GitHub Actions (`.github/workflows/deploy.yml`) fa `git reset --hard` sul server, reinstalla le dipendenze, ricompila il frontend e riavvia `pm2 fit-api`. Servono questi secrets nel repo GitHub: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_PATH` (= `/var/www/fit-crystaltokyo`).

`backend/.env` non è in git (contiene i secret) — va creato una volta a mano sul server, il workflow lo preserva ad ogni deploy.
