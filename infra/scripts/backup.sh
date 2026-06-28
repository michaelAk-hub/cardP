#!/usr/bin/env bash
# Nightly encrypted Postgres backup (spec §8 "Backups").
# Wire into cron on the VPS:  5 3 * * *  /opt/blue-card/infra/scripts/backup.sh
# Reads everything from the environment; never hardcode credentials.
set -euo pipefail

: "${POSTGRES_USER:?set POSTGRES_USER}"
: "${POSTGRES_DB:?set POSTGRES_DB}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${BACKUP_DIR:=/var/backups/bluecard}"
# Optional: gpg passphrase for at-rest encryption of the dump.
BACKUP_GPG_PASSPHRASE="${BACKUP_GPG_PASSPHRASE:-}"
# Optional: S3-style target for off-site copy (requires aws cli configured).
BACKUP_S3_URI="${BACKUP_S3_URI:-}"

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/bluecard-${STAMP}.sql.gz"

echo "Dumping ${POSTGRES_DB} -> ${OUT}"
pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
  | gzip > "${OUT}"

if [ -n "${BACKUP_GPG_PASSPHRASE}" ]; then
  echo "Encrypting backup with gpg"
  gpg --batch --yes --passphrase "${BACKUP_GPG_PASSPHRASE}" \
    --symmetric --cipher-algo AES256 "${OUT}"
  rm -f "${OUT}"
  OUT="${OUT}.gpg"
fi

if [ -n "${BACKUP_S3_URI}" ]; then
  echo "Uploading to ${BACKUP_S3_URI}"
  aws s3 cp "${OUT}" "${BACKUP_S3_URI%/}/$(basename "${OUT}")"
fi

# Retain the last 14 local backups.
ls -1t "${BACKUP_DIR}"/bluecard-*.sql.gz* 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Done: ${OUT}"
# Restore (test this periodically!):
#   gpg -d backup.sql.gz.gpg | gunzip | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
