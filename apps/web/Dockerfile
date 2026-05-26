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

RUN pnpm install --frozen-lockfile --network-concurrency 1

# Prisma generate must run explicitly — postinstall is skipped with --frozen-lockfile in CI
RUN pnpm --filter @parta5/db exec prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

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
