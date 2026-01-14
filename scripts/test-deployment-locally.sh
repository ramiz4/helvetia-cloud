#!/bin/bash

# scripts/test-deployment-locally.sh
# This script simulates a production deployment locally on your MacBook.

set -e

echo "🚀 Starting Local Production Test..."

# 1. Setup Environment
echo "📝 Creating production environment configuration (.env.local)..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Copying from .env.example..."
    cp .env.example .env
fi

# Create a local production env file, inheriting from .env but overriding specific vars
# We use 'localhost' as the TLD for local testing because modern browsers
# automatically resolve *.localhost to 127.0.0.1, supporting wildcards.
cat .env > .env.local
echo "" >> .env.local
echo "# --- Local Production Overrides (No HTTPS) ---" >> .env.local
echo "NODE_ENV=production" >> .env.local
echo "DOMAIN_NAME=helvetia.localhost" >> .env.local
echo "ACME_EMAIL=admin@helvetia.localhost" >> .env.local
echo "APP_BASE_URL=http://helvetia.localhost" >> .env.local
echo "NEXT_PUBLIC_APP_URL=http://helvetia.localhost" >> .env.local
echo "NEXT_PUBLIC_API_URL=http://api.helvetia.localhost" >> .env.local
echo "NEXT_PUBLIC_WS_URL=ws://api.helvetia.localhost" >> .env.local

# 2. Build & Start Services
echo "🐳 Building and starting services (HTTP mode)..."

# Apply a temporary override to disable HTTPS in Traefik labels for local test
cat > docker-compose.local-test.yml <<EOF
services:
  traefik:
    command:
      - '--api.insecure=false'
      - '--providers.docker=true'
      - '--providers.docker.exposedbydefault=false'
      - '--providers.docker.endpoint=tcp://docker-socket-proxy:2375'
      - '--entrypoints.web.address=:80'

  api:
    environment:
      APP_BASE_URL: http://helvetia.localhost
      DASHBOARD_URL: http://helvetia.localhost
    labels:
      - 'traefik.http.routers.api.entrypoints=web'
      - 'traefik.http.routers.api.tls=false'

  dashboard:
    build:
      args:
        - NEXT_PUBLIC_API_URL=http://api.helvetia.localhost
        - NEXT_PUBLIC_WS_URL=ws://api.helvetia.localhost
        - NEXT_PUBLIC_APP_URL=http://helvetia.localhost
    environment:
      NEXT_PUBLIC_API_URL: http://api.helvetia.localhost
      NEXT_PUBLIC_WS_URL: ws://api.helvetia.localhost
      NEXT_PUBLIC_APP_URL: http://helvetia.localhost
    labels:
      - 'traefik.http.routers.dashboard.entrypoints=web'
      - 'traefik.http.routers.dashboard.tls=false'

  grafana:
    labels:
      - 'traefik.http.routers.grafana.entrypoints=web'
      - 'traefik.http.routers.grafana.tls=false'
EOF

echo "   Command: docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file .env.local up -d --build"

docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file .env.local up -d --build

# 3. Run Database Migrations
echo "🐘 Running database migrations..."
docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml --env-file .env.local exec api pnpm --filter database migrate:deploy

# 4. Instructions for User
echo ""
echo "✅ Local Production Environment is running (HTTP mode)!"
echo "------------------------------------------------"
echo "🌐 Dashboard: http://helvetia.localhost"
echo "🔌 API:       http://api.helvetia.localhost/health"
echo "📊 Grafana:   http://monitor.helvetia.localhost"
echo ""
echo "💡 PRO TIP: Using .localhost means you DON'T need to edit /etc/hosts"
echo "   for your deployed services! Wildcard subdomains like"
# shellcheck disable=SC2016
echo "   'http://...helvetia.localhost' will just work in your browser."
echo ""
echo "------------------------------------------------"
echo "🛑 To stop the environment:"
echo "   docker compose -f docker-compose.prod.yml -f docker-compose.local-test.yml down"
echo "   rm docker-compose.local-test.yml"
