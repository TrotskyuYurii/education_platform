#!/usr/bin/env bash
# Щоденний бекап Mongo порталу → DigitalOcean Spaces (S3).
#
#   mongodump --archive --gzip  →  локальний файл  →  перевірка  →  S3  →  ротація
#
# Ротація за КІЛЬКІСТЮ (BACKUP_S3_KEEP / BACKUP_LOCAL_KEEP), а не за віком: якщо
# бекапи з якоїсь причини перестануть створюватись, старі не зникнуть самі.
# Старі копії видаляються лише після того, як нову підтверджено в S3.
#
# Запуск: cron користувача edu-deploy (див. DEPLOY.md). Налаштування — у .env
# поруч із docker-compose.prod.yml. Ручний запуск: deploy/backup-mongo.sh
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$APP_DIR"

set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${MONGO_DB:?MONGO_DB is not set in .env}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is not set in .env}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is not set in .env}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is not set in .env}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is not set in .env}"

PREFIX="${BACKUP_S3_PREFIX:-mongo/}"
S3_KEEP="${BACKUP_S3_KEEP:-30}"
LOCAL_KEEP="${BACKUP_LOCAL_KEEP:-3}"
BACKUP_DIR="$APP_DIR/backups"
AWS_IMAGE="${BACKUP_AWS_CLI_IMAGE:-amazon/aws-cli:latest}"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.prod.yml")

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
NAME="${MONGO_DB}-${STAMP}.archive.gz"
FILE="$BACKUP_DIR/$NAME"
STEP="init"

log() { echo "[$(date '+%F %T')] $*"; }

notify() {
  [ -n "${BACKUP_TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${BACKUP_TELEGRAM_CHAT_ID:-}" ] || return 0
  # Токен іде через конфіг зі stdin, а не аргументом — щоб не світився в ps.
  curl -sS -o /dev/null --max-time 20 -K - \
    --data-urlencode "chat_id=${BACKUP_TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" <<EOF || true
url = "https://api.telegram.org/bot${BACKUP_TELEGRAM_BOT_TOKEN}/sendMessage"
EOF
}

on_error() {
  local code=$?
  log "FAILED at step '$STEP' (exit $code)"
  rm -f "$FILE.partial"
  notify "❌ education-platform: бекап Mongo ПРОВАЛИВСЯ на кроці «${STEP}» ($(hostname), ${STAMP})"
  exit "$code"
}
trap on_error ERR

# Ключі передаються в контейнер aws-cli через змінні оточення, не аргументами.
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
export AWS_DEFAULT_REGION="us-east-1"   # Spaces ігнорує регіон, але CLI його вимагає
# Нові версії aws-cli за замовчуванням шлють CRC-контрольні суми, які
# S3-сумісні сховища підтримують не завжди.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required

aws() {
  docker run --rm -i \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
    -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION \
    -v "$BACKUP_DIR:/backups:ro" \
    "$AWS_IMAGE" --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"
}

# Два запуски одночасно (cron + ручний) не повинні писати й ротувати разом.
mkdir -p "$BACKUP_DIR"
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || { log "Another backup is running, exiting"; exit 0; }

STEP="mongodump"
log "Dumping database $MONGO_DB"
# Облікові дані root беремо зі змінних всередині контейнера mongo.
"${COMPOSE[@]}" exec -T mongo sh -c \
  'mongodump --quiet --archive --gzip --db "$MONGO_DB" -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "$FILE.partial"

STEP="verify archive"
gzip -t "$FILE.partial"
SIZE=$(stat -c %s "$FILE.partial")
[ "$SIZE" -gt 0 ]
mv "$FILE.partial" "$FILE"
log "Archive $NAME ($SIZE bytes)"

STEP="upload to S3"
aws s3 cp --only-show-errors "/backups/$NAME" "s3://$BACKUP_S3_BUCKET/$PREFIX$NAME"

STEP="verify upload"
REMOTE_SIZE=$(aws s3api head-object --bucket "$BACKUP_S3_BUCKET" --key "$PREFIX$NAME" \
  --query ContentLength --output text)
[ "$REMOTE_SIZE" = "$SIZE" ] || { log "Size mismatch: local $SIZE, remote $REMOTE_SIZE"; false; }
log "Uploaded s3://$BACKUP_S3_BUCKET/$PREFIX$NAME"

STEP="rotate S3"
# Імена містять UTC-час у форматі ISO, тож сортування за іменем = за часом.
mapfile -t REMOTE < <(
  aws s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix "$PREFIX${MONGO_DB}-" \
    --query 'Contents[].Key' --output text | tr '\t' '\n' | grep '\.archive\.gz$' | sort
)
REMOVE_COUNT=$(( ${#REMOTE[@]} - S3_KEEP ))
for (( i = 0; i < REMOVE_COUNT; i++ )); do
  log "Removing old S3 backup ${REMOTE[$i]}"
  aws s3 rm --only-show-errors "s3://$BACKUP_S3_BUCKET/${REMOTE[$i]}"
done

STEP="rotate local"
ls -1 "$BACKUP_DIR"/"${MONGO_DB}"-*.archive.gz | sort | head -n -"$LOCAL_KEEP" | xargs -r rm -f

KEPT=$(( ${#REMOTE[@]} > S3_KEEP ? S3_KEEP : ${#REMOTE[@]} ))
HUMAN=$(numfmt --to=iec "$SIZE")
log "Done: $NAME, $HUMAN, S3 copies kept: $KEPT"
notify "✅ education-platform: бекап Mongo готовий — ${HUMAN}, у S3 зберігається ${KEPT} копій"
