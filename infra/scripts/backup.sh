#!/usr/bin/env bash
# Nightly encrypted Postgres backup (spec §8 "Backups").
# Placeholder for the deploy milestone — wire into cron on the VPS and push the
# dump to the object store. Do NOT hardcode credentials; read from the env.
set -euo pipefail

: "${POSTGRES_USER:?set POSTGRES_USER}"
: "${POSTGRES_DB:?set POSTGRES_DB}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="bluecard-${STAMP}.sql.gz"

echo "Dumping ${POSTGRES_DB} -> ${OUT}"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${OUT}"

# TODO(deploy): encrypt (age/gpg) and upload to the object store; verify restore.
echo "Done. Remember to encrypt and off-site this dump."
