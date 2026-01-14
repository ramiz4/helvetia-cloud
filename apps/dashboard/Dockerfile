FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy source code
COPY . .

ENV CI=true

# Install dependencies based on the lockfile
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY --from=deps /app ./

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GITHUB_CLIENT_ID
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_PLATFORM_DOMAIN

# Build the dashboard application
RUN pnpm --filter dashboard build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
# The standalone output preserves the directory structure (e.g., apps/dashboard/server.js)
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs

EXPOSE 3000

ENV PORT 3000
# Validating the path to server.js based on monorepo structure in standalone output
CMD ["node", "apps/dashboard/server.js"]
