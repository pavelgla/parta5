FROM node:22-slim AS base
RUN apt-get update && apt-get install -y ffmpeg --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS runner
WORKDIR /app

# Prevent corepack from re-downloading the version pinned in packageManager.
ENV COREPACK_ENABLE_STRICT=0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
# The whole packages/ tree: the worker depends on db, storage, video, quiz and
# importer, and copying them selectively silently breaks whenever a new package
# is added — which is exactly how this image fell behind the course importer.
COPY packages/ packages/
COPY apps/worker/ apps/worker/

RUN pnpm install --frozen-lockfile --network-concurrency 1

# postinstall is skipped with --frozen-lockfile, so the client is generated here.
RUN pnpm --filter @parta5/db exec prisma generate

WORKDIR /app/apps/worker
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
