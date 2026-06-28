# nginx (production reverse proxy + TLS)

Front proxy for the Hostinger VPS (spec §10). Routes:

- `https://api.<domain>`   → `api` container (NestJS) on :3000
- `https://admin.<domain>` → `admin` container (static dashboard) on :80

Config is rendered from `templates/bluecard.conf.template` at container start
(`envsubst` fills `${API_DOMAIN}` / `${ADMIN_DOMAIN}` from the environment).
Certificates live in `certbot/conf` (Let's Encrypt) and are renewed by the
`certbot` service in `docker-compose.prod.yml`.

## First-time setup

1. Point DNS A records for `api.<domain>` and `admin.<domain>` at the VPS.
2. Put the domains + email in the server `.env`:
   ```
   API_DOMAIN=api.example.com
   ADMIN_DOMAIN=admin.example.com
   LETSENCRYPT_EMAIL=ops@example.com
   ```
3. Obtain certificates (creates temp self-signed certs, starts nginx, then
   swaps in real ones):
   ```bash
   API_DOMAIN=api.example.com ADMIN_DOMAIN=admin.example.com \
   LETSENCRYPT_EMAIL=ops@example.com \
   bash infra/scripts/init-letsencrypt.sh
   ```
   Use `LETSENCRYPT_STAGING=1` while testing to avoid rate limits.
4. Bring up the full stack:
   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file .env up -d
   ```

Renewal is automatic (the `certbot` service runs `certbot renew` every 12h and
nginx reloads every 6h). `certbot/conf` and `certbot/www` are created on first run.
