FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS builder
WORKDIR /app

# AUTH_SECRET is required by Next.js at build time (Auth.js assertConfig).
# Pass a non-empty placeholder here; the real value is injected at runtime.
ARG AUTH_SECRET=build_placeholder_not_used_at_runtime
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

ENV AUTH_SECRET=$AUTH_SECRET
ENV DATABASE_URL=$DATABASE_URL

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

# Prevent corepack from downloading the exact version pinned in packageManager
# when the base layer already has pnpm installed via corepack prepare @latest.
ENV COREPACK_ENABLE_STRICT=0
RUN pnpm install --frozen-lockfile --network-concurrency 1

# Prisma generate must run explicitly — postinstall is skipped with --frozen-lockfile in CI
RUN pnpm --filter @parta5/db exec prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# Prisma native engine (.so.node) is not picked up by Next.js file tracing in pnpm monorepos.
# Copy it explicitly into the standalone output so the runner can find it at runtime.
RUN find /app/node_modules/.pnpm -name "*.node" -path "*/.prisma/client/*" | \
    while read src; do \
      rel="${src#/app/}"; \
      dest="/app/apps/web/.next/standalone/${rel%/*}"; \
      mkdir -p "$dest"; \
      cp "$src" "$dest/"; \
    done

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
