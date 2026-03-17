#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DEPLOY_DIR}"

if [[ ! -f ".env.production" ]]; then
  echo "Missing deploy/.env.production. Copy deploy/.env.production.example first."
  exit 1
fi

set -a
source ./.env.production
set +a

BACKUP_DIR="${DEPLOY_DIR}/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PATH="${BACKUP_DIR}/mongo-${TIMESTAMP}.archive.gz"
CONTAINER_NAME="${PROJECT_NAME:-esports-mood-tracker}-mongo"

mkdir -p "${BACKUP_DIR}"

docker exec "${CONTAINER_NAME}" sh -lc \
  "mongodump --username \"${MONGO_ROOT_USERNAME}\" --password \"${MONGO_ROOT_PASSWORD}\" --authenticationDatabase admin --archive --gzip" \
  > "${ARCHIVE_PATH}"

echo "Backup saved to ${ARCHIVE_PATH}"
