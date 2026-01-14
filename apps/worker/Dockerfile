FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter database generate

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app ./
# Build dependencies
RUN pnpm --filter database build
RUN pnpm --filter shared build
# Build Worker
RUN pnpm --filter worker build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# Install Docker CLI and Git for worker tasks
RUN apk add --no-cache docker-cli git

# Copy necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/index.js"]
