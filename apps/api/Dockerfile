# syntax=docker/dockerfile:1
# Сборка из корня репозитория: docker build -f apps/api/Dockerfile .

# В node:22-alpine уже есть libssl3 — его использует Prisma (engine linux-musl-openssl-3.0.x).
# Часовой пояс Europe/Moscow Node берёт из встроенного ICU, пакет tzdata не нужен.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
# Манифесты всех пакетов workspace + общий пакет и схема Prisma (нужны install-скриптам)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/prisma apps/api/prisma

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@kirilovskiy/api..."
COPY apps/api apps/api
RUN pnpm --filter @kirilovskiy/shared build \
 && pnpm --filter @kirilovskiy/api exec prisma generate \
 && pnpm --filter @kirilovskiy/api build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@kirilovskiy/api..." \
 && pnpm --filter @kirilovskiy/api exec prisma generate

FROM node:22-alpine AS runtime
ENV NODE_ENV=production TZ=Europe/Moscow
WORKDIR /repo
COPY --from=prod-deps /repo/node_modules ./node_modules
# Ссылка на workspace-пакет @kirilovskiy/shared (pnpm кладёт её в node_modules приложения)
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/public apps/api/public
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
WORKDIR /repo/apps/api
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
