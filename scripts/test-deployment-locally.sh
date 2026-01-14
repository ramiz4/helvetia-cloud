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
# We use 'local' as the TLD for local testing
cat .env > .env.production.local
echo "" >> .env.production.local
echo "# --- Local Production Overrides ---" >> .env.production.local
echo "NODE_ENV=production" >> .env.production.local
echo "DOMAIN_NAME=helvetia.local" >> .env.production.local
echo "ACME_EMAIL=admin@helvetia.local" >> .env.production.local

# 2. Build & Start Services
echo "🐳 Building and starting services (this closely matches the VPS script)..."
echo "   Command: docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build"

docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build

# 3. Instructions for User
echo ""
echo "✅ Local Production Environment is running!"
echo "------------------------------------------------"
echo "👉 To access the services, you MUST update your /etc/hosts file."
echo "   Run the following command to add the mappings:"
echo ""
echo "   sudo sh -c 'echo \"127.0.0.1 helvetia.local api.helvetia.local monitor.helvetia.local\" >> /etc/hosts'"
echo ""
echo "------------------------------------------------"
echo "🌐 Dashboard: https://helvetia.local"
echo "   (You will see a security warning because the SSL certificate is self-signed/invalid. Click 'Advanced' -> 'Proceed')."
echo "🔌 API:       https://api.helvetia.local/health"
echo "📊 Grafana:   https://monitor.helvetia.local (User: admin, Pwd: See GRAFANA_PASSWORD in .env)"
echo "------------------------------------------------"
echo "🛑 To stop the environment:"
echo "   docker compose -f docker-compose.prod.yml down"
