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
# Build API
RUN pnpm --filter api build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

# Copy necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
