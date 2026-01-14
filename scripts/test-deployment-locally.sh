#!/bin/bash

# scripts/test-deployment-locally.sh
# This script simulates a production deployment locally on your MacBook.

set -e

echo "🚀 Starting Local Production Test..."

# 1. Setup Environment
echo "📝 Creating production environment configuration (.env.production.local)..."
if [ ! -f .env ]; then
    echo "⚠️  .env file not found! Copying from .env.example..."
    cp .env.example .env
fi

# Create a local production env file, inheriting from .env but overriding specific vars
# We use 'localhost' as the TLD for local testing because modern browsers
# automatically resolve *.localhost to 127.0.0.1, supporting wildcards.
cat .env > .env.production.local
echo "" >> .env.production.local
echo "# --- Local Production Overrides ---" >> .env.production.local
echo "NODE_ENV=production" >> .env.production.local
echo "DOMAIN_NAME=helvetia.localhost" >> .env.production.local
echo "ACME_EMAIL=admin@helvetia.localhost" >> .env.production.local

# 2. Build & Start Services
echo "🐳 Building and starting services (this closely matches the VPS script)..."
echo "   Command: docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build"

docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build

# 3. Run Database Migrations
echo "🐘 Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file .env.production.local exec api pnpm --filter database migrate:deploy

# 4. Instructions for User
echo ""
echo "✅ Local Production Environment is running!"
echo "------------------------------------------------"
echo "🌐 Dashboard: https://helvetia.localhost"
echo "🔌 API:       https://api.helvetia.localhost/health"
echo "📊 Grafana:   https://monitor.helvetia.localhost"
echo ""
echo "💡 PRO TIP: Using .localhost means you DON'T need to edit /etc/hosts"
echo "   for your deployed services! Wildcard subdomains like"
echo "   'http://...helvetia.localhost' will just work in your browser."
echo ""
echo "⚠️  IMPORTANT FOR LOCAL TESTING:"
echo "   Visit BOTH the Dashboard AND the API URLs above and click"
echo "   'Advanced' -> 'Proceed' (to accept the self-signed certificates)."
echo "------------------------------------------------"
echo "🛑 To stop the environment:"
echo "   docker compose -f docker-compose.prod.yml down"
