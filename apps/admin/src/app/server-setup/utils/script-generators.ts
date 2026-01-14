export interface SetupConfig {
  domain: string;
  email: string;
  postgresPassword: string;
  grafanaPassword: string;
  githubClientId: string;
  githubClientSecret: string;
  jwtSecret: string;
  cookieSecret: string;
  encryptionKey: string;
  encryptionSalt: string;
  repoUrl: string;
  branch: string;
  helvetiaAdmin: string;
  helvetiaAdminPassword: string;
}

export const generatePrepareScript = () => {
  return `#!/bin/bash

# Helvetia Cloud Server Preparation Script
# This script hardens security, optimizes performance, and installs Docker.

set -e

echo "🛡️ Starting Helvetia Cloud Server Preparation..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw

# 2. Firewall Configuration
echo "🔥 Configuring Firewall (UFW)..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 3. Swap File Creation (2GB)
if [ ! -f /swapfile ] && [ "$(sudo swapon --show)" == "" ]; then
    echo "🧠 Creating 2GB Swap file for stability..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap file created and enabled."
else
    echo "✅ Swap already configured."
fi

# 4. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed."
else
    echo "✅ Docker already installed."
fi

# 5. Docker Log Management (Log Rotation)
echo "📝 Setting Docker log limits to prevent disk filling..."
sudo mkdir -p /etc/docker
cat <<EOF | sudo tee /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker

echo ""
echo "✨ Preparation Complete!"
echo "------------------------------------------------"
echo "💡 NEXT STEP: Run the Setup Script to deploy Helvetia Cloud."
echo "------------------------------------------------"
`;
};

export const generateSetupScript = (config: SetupConfig) => {
  const escapeEnv = (val: string) => val.replace(/\$/g, '$$$$');

  return `#!/bin/bash

# Helvetia Cloud Application Setup Script
# This script clones the repository and starts the production stack.

set -e

echo "🚀 Starting Helvetia Cloud Application Setup..."

# 1. Setup Directory
INSTALL_DIR="/opt/helvetia"
echo "📂 Setting up installation directory at $INSTALL_DIR..."
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# 2. Clone Repository
if [ -d ".git" ]; then
    echo "🔄 Repository exists. Pulling latest changes from ${config.branch}..."
    git fetch origin ${config.branch}
    git checkout ${config.branch}
    git pull origin ${config.branch}
else
    echo "⬇️ Cloning repository (branch: ${config.branch})..."
    git clone -b ${config.branch} ${config.repoUrl} .
fi

# 3. Create .env file
echo "📝 Configuring environment variables..."
cat > .env <<'EOL'
DOMAIN_NAME=${config.domain}
ACME_EMAIL=${config.email}
POSTGRES_PASSWORD=${escapeEnv(config.postgresPassword)}
POSTGRES_USER=helvetia
POSTGRES_DB=helvetia
DATABASE_URL=${escapeEnv(
    `postgresql://helvetia:${config.postgresPassword}@postgres:5432/helvetia?schema=public`,
  )}
GRAFANA_PASSWORD=${escapeEnv(config.grafanaPassword)}
GITHUB_CLIENT_ID=${config.githubClientId}
GITHUB_CLIENT_SECRET=${escapeEnv(config.githubClientSecret)}
JWT_SECRET=${escapeEnv(config.jwtSecret)}
COOKIE_SECRET=${escapeEnv(config.cookieSecret)}
ENCRYPTION_KEY=${escapeEnv(config.encryptionKey)}
ENCRYPTION_SALT=${escapeEnv(config.encryptionSalt)}
HELVETIA_ADMIN=${config.helvetiaAdmin}
HELVETIA_ADMIN_PASSWORD=${escapeEnv(config.helvetiaAdminPassword)}
EOL

# 4. Create Directories for Volumes
mkdir -p letsencrypt postgres_data prometheus_data grafana_data

# 5. Cleanup old services
echo "🧹 Removing old services..."
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    docker compose -f docker-compose.prod.yml down -v || true
fi

# 6. Start Services
echo "🚀 Starting services (building images, this may take a while)..."
docker compose -f docker-compose.prod.yml up -d --build

# 7. Run Database Migrations
echo "🐘 Waiting for PostgreSQL to be ready..."
until docker compose -f docker-compose.prod.yml exec postgres pg_isready -U helvetia; do
  echo "⏳ Database is starting up..."
  sleep 2
done

echo "🏗️ Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter database migrate:deploy

echo "✅ Deployment complete!"
echo "------------------------------------------------"
echo "🌐 Dashboard: https://${config.domain}"
echo "🔌 API:       https://api.${config.domain}"
echo "📊 Monitoring: https://monitor.${config.domain}"
echo "------------------------------------------------"
`;
};

export const generateRandomString = (length: number, hex = false) => {
  const chars = hex
    ? '0123456789abcdef'
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!^*()-_=+';
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined') {
    window.crypto.getRandomValues(array);
  }
  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join('');
};
