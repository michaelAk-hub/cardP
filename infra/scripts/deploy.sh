#!/usr/bin/env bash
# Pull the latest images and (re)start the stack on the VPS. Run from the repo
# root on the server (the GitHub Actions deploy workflow invokes this over SSH).
#
#   API_IMAGE=ghcr.io/owner/blue-card-api:<sha> \
#   ADMIN_IMAGE=ghcr.io/owner/blue-card-admin:<sha> \
#   bash infra/scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/../.."   # repo root
COMPOSE="docker compose -f infra/docker-compose.prod.yml --env-file .env"

echo "### Pulling images"
$COMPOSE pull api worker admin || true

echo "### Starting database + redis"
$COMPOSE up -d postgres redis

# api runs `prisma migrate deploy` on start, so bring it up before the worker.
echo "### Starting api (applies migrations), worker, admin, nginx"
$COMPOSE up -d api
$COMPOSE up -d worker admin nginx

echo "### Pruning old images"
docker image prune -f >/dev/null || true
echo "### Deploy complete."
$COMPOSE ps
