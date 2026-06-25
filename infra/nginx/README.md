# nginx (deploy)

Reverse proxy + TLS termination for the Hostinger VPS deployment (spec §10).
Populated at the **deploy milestone**. Planned routes:

- `api.<domain>`   → `api` container (NestJS)
- `admin.<domain>` → static admin build (served by nginx)

TLS via Let's Encrypt (Certbot). Config and certs are environment-specific and
are **not** committed — they are provisioned on the VPS.
