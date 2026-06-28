#!/usr/bin/env bash
# One-time TLS bootstrap for the two domains (api.<domain>, admin.<domain>).
# Solves the chicken-and-egg: nginx needs certs to start, certbot needs nginx
# (HTTP-01) to issue them. We drop temporary self-signed certs, start nginx,
# then replace them with real Let's Encrypt certs.
#
#   API_DOMAIN=api.example ADMIN_DOMAIN=admin.example \
#   LETSENCRYPT_EMAIL=you@example LETSENCRYPT_STAGING=0 \
#   bash infra/scripts/init-letsencrypt.sh
set -euo pipefail

cd "$(dirname "$0")/.."   # -> infra/
COMPOSE="docker compose -f docker-compose.prod.yml --env-file ../.env"
CONF="./nginx/certbot/conf"
: "${API_DOMAIN:?set API_DOMAIN}"
: "${ADMIN_DOMAIN:?set ADMIN_DOMAIN}"
: "${LETSENCRYPT_EMAIL:?set LETSENCRYPT_EMAIL}"
STAGING="${LETSENCRYPT_STAGING:-0}"
DOMAINS=("$API_DOMAIN" "$ADMIN_DOMAIN")

mkdir -p "$CONF" ./nginx/certbot/www

echo "### Creating temporary self-signed certs so nginx can start"
for d in "${DOMAINS[@]}"; do
  mkdir -p "$CONF/live/$d"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CONF/live/$d/privkey.pem" \
    -out "$CONF/live/$d/fullchain.pem" \
    -subj "/CN=$d" >/dev/null 2>&1
done

echo "### Starting nginx"
$COMPOSE up -d nginx

echo "### Deleting temporary certs and requesting real ones"
staging_arg=""
[ "$STAGING" != "0" ] && staging_arg="--staging"
for d in "${DOMAINS[@]}"; do
  rm -rf "$CONF/live/$d" "$CONF/archive/$d" "$CONF/renewal/$d.conf"
  $COMPOSE run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot $staging_arg \
      --email $LETSENCRYPT_EMAIL --agree-tos --no-eff-email \
      -d $d --non-interactive" certbot
done

echo "### Reloading nginx with the new certs"
$COMPOSE exec nginx nginx -s reload
echo "### Done."
