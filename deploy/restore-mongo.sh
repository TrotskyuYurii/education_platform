#!/usr/bin/env bash
# Відновлення бекапу, зробленого deploy/backup-mongo.sh.
#
#   deploy/restore-mongo.sh --test  <архів>   перевірка: піднімає тимчасовий mongo,
#                                             відновлює туди і показує кількість документів
#   deploy/restore-mongo.sh --apply <архів>   відновлення в РОБОЧУ базу (з --drop),
#                                             лише після підтвердження вручну
#
# <архів> — локальний файл (backups/...archive.gz) або ключ у S3 (mongo/...archive.gz),
# тоді його спершу буде завантажено в backups/.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"
set -a
# shellcheck disable=SC1091
. ./.env
set +a

MODE="${1:-}"
SRC="${2:-}"
[[ "$MODE" == "--test" || "$MODE" == "--apply" ]] && [ -n "$SRC" ] || {
  sed -n '2,10p' "$0"; exit 2;
}

BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.prod.yml")

if [ -f "$SRC" ]; then
  FILE="$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")"
else
  FILE="$BACKUP_DIR/$(basename "$SRC")"
  echo "Downloading s3://$BACKUP_S3_BUCKET/$SRC"
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  AWS_DEFAULT_REGION=us-east-1 AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
  docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION -v "$BACKUP_DIR:/backups" \
    "${BACKUP_AWS_CLI_IMAGE:-amazon/aws-cli:latest}" --endpoint-url "$BACKUP_S3_ENDPOINT" \
    s3 cp --only-show-errors "s3://$BACKUP_S3_BUCKET/$SRC" "/backups/$(basename "$SRC")"
fi
gzip -t "$FILE"

COUNT_JS='db.getCollectionNames().sort().forEach(c => print(c.padEnd(40), db.getCollection(c).countDocuments()))'

if [ "$MODE" == "--test" ]; then
  NAME="edu-restore-test-$$"
  trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
  docker run -d --name "$NAME" --memory 1g mongo:7.0 --wiredTigerCacheSizeGB 0.25 >/dev/null
  for _ in $(seq 1 30); do
    docker exec "$NAME" mongosh --quiet --eval 'db.adminCommand("ping").ok' >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec -i "$NAME" mongorestore --quiet --archive --gzip < "$FILE"
  echo "Restored $(basename "$FILE") into a temporary instance. Documents per collection:"
  docker exec "$NAME" mongosh --quiet "$MONGO_DB" --eval "$COUNT_JS"
  echo "OK: backup is restorable (temporary container removed)."
  exit 0
fi

echo "!!! This will REPLACE database '$MONGO_DB' with $(basename "$FILE")."
read -r -p "Type the database name to confirm: " CONFIRM
[ "$CONFIRM" == "$MONGO_DB" ] || { echo "Cancelled."; exit 1; }
"${COMPOSE[@]}" stop app
"${COMPOSE[@]}" exec -T mongo sh -c \
  'mongorestore --quiet --drop --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  < "$FILE"
"${COMPOSE[@]}" start app
echo "Restored. Documents per collection:"
"${COMPOSE[@]}" exec -T mongo sh -c \
  'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin "$MONGO_DB" --eval "$0"' "$COUNT_JS"
