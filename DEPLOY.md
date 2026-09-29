# Розгортання: ep.viasecurity.tech

Продакшн живе на сервері **srv** (65.109.158.32, SSH-порт 22122) у Docker.
Кожен push у `main` автоматично тестується і розгортається GitHub Actions.

```
push у main ──► GitHub Actions: typecheck + тести (з Mongo)
                  └─► docker build ──► ghcr.io/viasecurity/education-platform:<sha>
                        └─► SSH (edu-deploy@srv): compose pull && up -d ──► smoke /api/health

srv: nginx :443 (ep.viasecurity.tech) ──► 127.0.0.1:3300 app ──► mongo (без порту назовні)
                                               cron 03:00 ──► backup-mongo.sh ──► DO Spaces
```

## Що де лежить

| Що | Де |
|---|---|
| Образ | `Dockerfile`: при старті міграції (`scripts/migrations`), потім `node dist/server.cjs` |
| Сервіси | `docker-compose.prod.yml`: `app` (127.0.0.1:3300) + `mongo:7.0` (ліміт 2 ГБ, кеш 1 ГБ) |
| CI/CD | `.github/workflows/deploy.yml` |
| Каталог на srv | `/opt/education-platform` (власник `edu-deploy`) |
| Інфраструктурні змінні | `/opt/education-platform/.env` (шаблон `deploy/env.prod.example`) |
| Змінні застосунку | `/opt/education-platform/app.env` (шаблон `deploy/app.env.example`) |
| Дані Mongo | `/opt/education-platform/mongo-data` |
| Локальні бекапи | `/opt/education-platform/backups` |
| nginx | `/etc/nginx/sites-available/ep.viasecurity.tech` (шаблон `deploy/nginx/`) |

`docker-compose.prod.yml` і `deploy/` кожен деплой копіює на сервер із репозиторію.
`.env` та `app.env` існують **тільки** на сервері й ніколи не комітяться.

## Секрети GitHub (Settings → Secrets → Actions)

| Секрет | Значення |
|---|---|
| `SRV_HOST` | `65.109.158.32` |
| `SRV_PORT` | `22122` |
| `SRV_USER` | `edu-deploy` |
| `SRV_SSH_KEY` | приватний ключ ed25519, публічна частина — у `~edu-deploy/.ssh/authorized_keys` |
| `SRV_APP_DIR` | `/opt/education-platform` (необовʼязково — це значення за замовчуванням) |

## Перше розгортання

1. Користувач і каталог (root):
   ```bash
   useradd -m -s /bin/bash edu-deploy && passwd -l edu-deploy && usermod -aG docker edu-deploy
   install -d -m 750 -o edu-deploy -g edu-deploy /opt/education-platform
   ```
2. Файли змінних (під `edu-deploy`) — заповнити за шаблонами, секрети згенерувати на місці:
   ```bash
   cd /opt/education-platform
   openssl rand -hex 32   # MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD (лише hex!)
   openssl rand -hex 48   # JWT_SECRET
   chmod 600 .env app.env
   ```
   Шаблони потрапляють у `deploy/` після першого запуску workflow; до того їх можна
   скопіювати з репозиторію вручну.
3. Запустити workflow (push у `main` або **Actions → Run workflow**). Перевірка:
   `curl -s 127.0.0.1:3300/api/health` → `"dbConnected":true`.
4. nginx — див. нижче.
5. Увійти `admin` / `admin123`, **одразу** створити власного адміністратора —
   стандартний обліковий запис після цього видаляється автоматично.

## nginx + HTTPS

Як і решта сайтів на srv — через `sites-available` / `sites-enabled`.
Шаблон `deploy/nginx/ep.viasecurity.tech`; SSL-параметри звірити з сусідніми сайтами.

```bash
cp deploy/nginx/ep.viasecurity.tech /etc/nginx/sites-available/
ln -s ../sites-available/ep.viasecurity.tech /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## Бекапи Mongo

`deploy/backup-mongo.sh` — раз на добу: `mongodump --archive --gzip` → перевірка архіву →
DigitalOcean Spaces (`education-platform`, fra1, префікс `mongo/`) → перевірка розміру в S3 →
ротація → сповіщення в Telegram.

- Глибина: `BACKUP_S3_KEEP` (у S3) і `BACKUP_LOCAL_KEEP` (на srv) у `.env`.
- Ротація **за кількістю**: старі копії видаляються лише після успішного завантаження нової,
  тож якщо бекапи зламаються, наявні не зникнуть.
- Будь-яка помилка → повідомлення «ПРОВАЛИВСЯ» з назвою кроку.

Cron користувача `edu-deploy` (`crontab -e`):

```
0 3 * * * /opt/education-platform/deploy/backup-mongo.sh >> /opt/education-platform/backups/backup.log 2>&1
```

### Відновлення

```bash
# Перевірка бекапу: тимчасовий mongo, відновлення, кількість документів. Прод не чіпає.
deploy/restore-mongo.sh --test mongo/education_platform-<дата>.archive.gz   # з S3
deploy/restore-mongo.sh --test backups/education_platform-<дата>.archive.gz # локальний

# Відновлення в робочу базу (зупиняє app, --drop, просить ввести назву бази).
deploy/restore-mongo.sh --apply backups/education_platform-<дата>.archive.gz
```

Тестове відновлення — раз на місяць.

## Щоденні операції

```bash
cd /opt/education-platform
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=200 app
docker compose -f docker-compose.prod.yml restart app      # після зміни app.env
```

**Відкат:** Actions → останній вдалий запуск на потрібному коміті → *Re-run all jobs*,
або на сервері вписати попередній `IMAGE_TAG=<sha>` у `.env` і
`docker compose -f docker-compose.prod.yml up -d app`.

## Обмеження

- **Лише одна репліка `app`**: планувальник сповіщень працює всередині процесу,
  кілька копій дублюватимуть розсилки.
- Service worker (офлайн-режим) працює лише через HTTPS.
