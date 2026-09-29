#!/bin/sh
# Спершу міграції (вже виконані пропускаються), потім сервер. Якщо міграція
# впала — контейнер не стартує, і деплой зупиниться на smoke-перевірці.
set -e

node_modules/.bin/tsx scripts/migrations/runner.ts

exec node dist/server.cjs
