'use client';

import { ArrowLeft, Check, Copy, Globe, Info, Server, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ServerSetupPage() {
  const [config, setConfig] = useState({
    domain: 'example.com',
    email: 'admin@example.com',
    postgresPassword: 'secure_password_here',
    grafanaPassword: 'admin',
    githubClientId: '',
    githubClientSecret: '',
    jwtSecret: 'generate_a_secure_random_string',
    cookieSecret: 'generate_another_secure_random_string',
    encryptionKey: 'provide_32_char_hex_key',
    encryptionSalt: 'provide_64_char_hex_salt',
    repoUrl: 'https://github.com/ramiz4/helvetia-cloud.git',
    branch: 'feature/deployment-setup',
    helvetiaAdmin: 'admin',
    helvetiaAdminPassword: 'admin',
  });

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(generateScript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateScript = () => {
    return `#!/bin/bash

# Helvetia Cloud Server Setup Script
# This script installs Docker, clones the repository, and sets up the environment.

set -e

echo "🚀 Starting Helvetia Cloud Server Setup..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git

# 2. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed."
else
    echo "✅ Docker already installed."
fi

# 3. Setup Directory
INSTALL_DIR="/opt/helvetia"
echo "📂 Setting up installation directory at $INSTALL_DIR..."
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# 4. Clone Repository
if [ -d ".git" ]; then
    echo "🔄 Repository exists. Pulling latest changes from ${config.branch}..."
    git fetch origin ${config.branch}
    git checkout ${config.branch}
    git pull origin ${config.branch}
else
    echo "⬇️ Cloning repository (branch: ${config.branch})..."
    git clone -b ${config.branch} ${config.repoUrl} .
fi

# 5. Create .env file
echo "📝 Configuring environment variables..."
cat > .env <<EOL
DOMAIN_NAME=${config.domain}
ACME_EMAIL=${config.email}
POSTGRES_PASSWORD=${config.postgresPassword}
POSTGRES_USER=helvetia
POSTGRES_DB=helvetia
GRAFANA_PASSWORD=${config.grafanaPassword}
GITHUB_CLIENT_ID=${config.githubClientId}
GITHUB_CLIENT_SECRET=${config.githubClientSecret}
JWT_SECRET=${config.jwtSecret}
COOKIE_SECRET=${config.cookieSecret}
ENCRYPTION_KEY=${config.encryptionKey}
ENCRYPTION_SALT=${config.encryptionSalt}
HELVETIA_ADMIN=${config.helvetiaAdmin}
HELVETIA_ADMIN_PASSWORD=${config.helvetiaAdminPassword}
EOL

# 6. Create Directories for Volumes
mkdir -p letsencrypt postgres_data prometheus_data grafana_data

# 7. Cleanup old services
echo "🧹 Removing old services..."
docker compose -f docker-compose.prod.yml down -v

# 8. Start Services
echo "🚀 Starting services (building images, this may take a while)..."
docker compose -f docker-compose.prod.yml up -d --build

# 9. Run Database Migrations
echo "🐘 Running database migrations..."
docker compose -f docker-compose.prod.yml exec api pnpm --filter database migrate:deploy

echo "✅ Deployment complete!"
echo "------------------------------------------------"
echo "🌐 Dashboard: https://${config.domain}"
echo "🔌 API:       https://api.${config.domain}"
echo "📊 Monitoring: https://monitor.${config.domain}"
echo "------------------------------------------------"
`;
  };

  return (
    <div className="min-h-screen bg-slate-950 py-8 animate-fade-in text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[24px] bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner">
              <Server size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter leading-none">
                Server Setup Routine
              </h1>
              <p className="text-slate-400 text-lg font-medium mt-2">
                Generate a deployment script for your VPS
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Configuration Form */}
          <div className="space-y-6">
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Globe size={20} className="text-blue-400" />
                Configuration
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Domain Name
                  </label>
                  <input
                    type="text"
                    value={config.domain}
                    onChange={(e) => setConfig({ ...config, domain: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Admin Email (SSL)
                  </label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Repository URL
                  </label>
                  <input
                    type="text"
                    value={config.repoUrl}
                    onChange={(e) => setConfig({ ...config, repoUrl: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Repository Branch
                  </label>
                  <input
                    type="text"
                    value={config.branch}
                    onChange={(e) => setConfig({ ...config, branch: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Postgres Password
                    </label>
                    <input
                      type="password"
                      value={config.postgresPassword}
                      onChange={(e) => setConfig({ ...config, postgresPassword: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Grafana Password
                    </label>
                    <input
                      type="password"
                      value={config.grafanaPassword}
                      onChange={(e) => setConfig({ ...config, grafanaPassword: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Dashboard Admin User
                    </label>
                    <input
                      type="text"
                      value={config.helvetiaAdmin}
                      onChange={(e) => setConfig({ ...config, helvetiaAdmin: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Dashboard Admin Password
                    </label>
                    <input
                      type="password"
                      value={config.helvetiaAdminPassword}
                      onChange={(e) => setConfig({ ...config, helvetiaAdminPassword: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      GitHub Client ID
                    </label>
                    <input
                      type="text"
                      value={config.githubClientId}
                      onChange={(e) => setConfig({ ...config, githubClientId: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      GitHub Client Secret
                    </label>
                    <input
                      type="password"
                      value={config.githubClientSecret}
                      onChange={(e) => setConfig({ ...config, githubClientSecret: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Encryption Key (32 char hex)
                    </label>
                    <input
                      type="text"
                      value={config.encryptionKey}
                      onChange={(e) => setConfig({ ...config, encryptionKey: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Encryption Salt (hex)
                    </label>
                    <input
                      type="text"
                      value={config.encryptionSalt}
                      onChange={(e) => setConfig({ ...config, encryptionSalt: e.target.value })}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl flex items-start gap-4">
              <Info className="text-blue-400 shrink-0 mt-1" size={20} />
              <div>
                <h3 className="font-bold text-blue-400 mb-1">Instructions</h3>
                <ol className="list-decimal list-inside text-sm text-slate-400 space-y-2">
                  <li>Provision a generic Linux VPS (Ubuntu 22.04 recommended).</li>
                  <li>Ensure ports 80 and 443 are open.</li>
                  <li>
                    Setup DNS A records for <code>{config.domain}</code>,{' '}
                    <code>api.{config.domain}</code>, and <code>monitor.{config.domain}</code>{' '}
                    pointing to the VPS IP.
                  </li>
                  <li>SSH into your VPS and run the generated script.</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Generated Script */}
          <div className="bg-slate-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col h-full">
            <div className="bg-slate-900/80 px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal size={18} />
                <span className="font-mono text-sm">setup.sh</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-slate-300"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Script'}
              </button>
            </div>
            <div className="flex-1 p-0 overflow-hidden relative group">
              <textarea
                readOnly
                value={generateScript()}
                className="w-full h-full bg-slate-950 p-6 font-mono text-sm text-slate-400 focus:outline-none resize-none"
                style={{ minHeight: '500px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
