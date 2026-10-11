#!/bin/sh
set -e

echo "→ Применяем миграции БД"
node ../../node_modules/prisma/build/index.js migrate deploy

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "→ Начальные данные (идемпотентно)"
  node dist/seed/seed.js
fi

echo "→ Запускаем API"
exec node dist/main.js
