FROM node:22-slim AS base
RUN apt-get update && apt-get install -y ffmpeg --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/storage/package.json ./packages/storage/
COPY packages/video/package.json ./packages/video/
RUN pnpm install --frozen-lockfile --filter @parta5/worker...

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules 2>/dev/null || true
COPY packages/db ./packages/db
COPY packages/storage ./packages/storage
COPY packages/video ./packages/video
COPY apps/worker ./apps/worker
COPY tsconfig.json ./
COPY pnpm-workspace.yaml ./
COPY package.json ./

WORKDIR /app/apps/worker
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
