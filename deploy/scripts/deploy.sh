#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DEPLOY_DIR}"

if [[ ! -f ".env.production" ]]; then
  echo "Missing deploy/.env.production. Copy deploy/.env.production.example first."
  exit 1
fi

docker compose -f docker-compose.prod.yml --env-file .env.production down --remove-orphans
docker compose -f docker-compose.prod.yml --env-file .env.production build --pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
docker compose -f docker-compose.prod.yml --env-file .env.production ps
