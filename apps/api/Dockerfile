FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm
COPY . .
ENV CI=true
RUN pnpm install --frozen-lockfile
RUN pnpm --filter database generate

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app ./
# Build dependencies
RUN pnpm --filter database build
RUN pnpm --filter shared build
# Build API
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# Enable PNPM to install production dependencies only
RUN npm install -g pnpm

# Copy package files for installing production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

# Install only production dependencies
# We skip the "prepare" scripts to avoid rebuilding packages
ENV CI=true
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# The API needs the schema for runtime validation in some cases (Prisma)
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
