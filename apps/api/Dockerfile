FROM node:22-trixie-slim AS base

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.json tsconfig.base.json ./
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --fetch-timeout=600000

FROM base AS builder
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/lib/api-zod/node_modules ./lib/api-zod/node_modules
COPY --from=deps /app/lib/db/node_modules ./lib/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY . .

WORKDIR /app/lib/db
RUN DATABASE_URL=postgresql://user:password@localhost:5432/prisma?schema=public \
    ./node_modules/.bin/prisma generate

WORKDIR /app/apps/api
RUN pnpm run build

FROM base AS production-deps
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY package.json tsconfig.json tsconfig.base.json ./
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --prod --frozen-lockfile --fetch-timeout=600000

FROM base AS runner
WORKDIR /app

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends awscli postgresql-client && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/pnpm /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg && \
    groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY --from=builder /app/lib/db/prisma ./lib/db/prisma
COPY --from=builder /app/lib/db/prisma.config.ts ./lib/db/prisma.config.ts
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-deps /app/lib/db/node_modules ./lib/db/node_modules
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client ./generated-prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client ./generated-prisma/.prisma/client
RUN set -- ./node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client && \
    rm -rf "$1" && \
    cp -a ./generated-prisma/client "$1" && \
    cp -a ./generated-prisma/.prisma "$(dirname "$(dirname "$1")")/.prisma" && \
    rm -rf ./generated-prisma && \
    chmod 755 ./apps/api/scripts/*.sh

USER appuser
WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "--enable-source-maps", "./dist/server.mjs"]
