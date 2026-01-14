'use client';

import { ArrowLeft, Check, Copy, Globe, Info, Server, Sparkles, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ServerSetupPage() {
  const [config, setConfig] = useState({
    domain: 'example.com',
    email: 'admin@example.com',
    postgresPassword: '',
    grafanaPassword: '',
    githubClientId: '',
    githubClientSecret: '',
    jwtSecret: '',
    cookieSecret: '',
    encryptionKey: '',
    encryptionSalt: '',
    repoUrl: 'https://github.com/ramiz4/helvetia-cloud.git',
    branch: 'feature/deployment-setup',
    helvetiaAdmin: 'admin',
    helvetiaAdminPassword: '',
  });

  const [copied, setCopied] = useState(false);

  const generateRandomString = (length: number, hex = false) => {
    const chars = hex
      ? '0123456789abcdef'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((x) => chars[x % chars.length])
      .join('');
  };

  const handleGenerate = (key: keyof typeof config, length = 32, hex = false) => {
    setConfig((prev) => ({ ...prev, [key]: generateRandomString(length, hex) }));
  };

  const InputWithAction = ({
    label,
    value,
    onChange,
    type = 'text',
    placeholder,
    onGenerate,
    labelAction,
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    type?: string;
    placeholder?: string;
    onGenerate?: () => void;
    labelAction?: React.ReactNode;
  }) => (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-400 group-focus-within:text-blue-400 transition-colors">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
          placeholder={placeholder}
        />
        {onGenerate && (
          <button
            onClick={onGenerate}
            title="Generate secure value"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all border border-blue-500/20 flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Auto</span>
          </button>
        )}
      </div>
    </div>
  );

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
cat > .env <<'EOL'
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
echo "🐘 Waiting for PostgreSQL to be ready..."
until docker compose -f docker-compose.prod.yml exec postgres pg_isready -U helvetia; do
  echo "⏳ Database is starting up..."
  sleep 2
done

echo "🏗️ Running database migrations..."
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
                <InputWithAction
                  label="Domain Name"
                  value={config.domain}
                  onChange={(val) => setConfig({ ...config, domain: val })}
                  placeholder="example.com"
                />

                <InputWithAction
                  label="Admin Email (SSL)"
                  value={config.email}
                  onChange={(val) => setConfig({ ...config, email: val })}
                  placeholder="admin@example.com"
                />

                <InputWithAction
                  label="Repository URL"
                  value={config.repoUrl}
                  onChange={(val) => setConfig({ ...config, repoUrl: val })}
                />

                <InputWithAction
                  label="Repository Branch"
                  value={config.branch}
                  onChange={(val) => setConfig({ ...config, branch: val })}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputWithAction
                    label="Postgres Password"
                    type="password"
                    value={config.postgresPassword}
                    onChange={(val) => setConfig({ ...config, postgresPassword: val })}
                    onGenerate={() => handleGenerate('postgresPassword')}
                    placeholder="Click Auto to generate"
                  />
                  <InputWithAction
                    label="Grafana Password"
                    type="password"
                    value={config.grafanaPassword}
                    onChange={(val) => setConfig({ ...config, grafanaPassword: val })}
                    onGenerate={() => handleGenerate('grafanaPassword')}
                    placeholder="Click Auto to generate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputWithAction
                    label="Dashboard Admin User"
                    value={config.helvetiaAdmin}
                    onChange={(val) => setConfig({ ...config, helvetiaAdmin: val })}
                  />
                  <InputWithAction
                    label="Dashboard Admin Password"
                    type="password"
                    value={config.helvetiaAdminPassword}
                    onChange={(val) => setConfig({ ...config, helvetiaAdminPassword: val })}
                    onGenerate={() => handleGenerate('helvetiaAdminPassword')}
                    placeholder="Click Auto to generate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputWithAction
                    label="GitHub Client ID"
                    value={config.githubClientId}
                    onChange={(val) => setConfig({ ...config, githubClientId: val })}
                    placeholder="Optional"
                    labelAction={
                      <a
                        href="https://github.com/settings/developers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold uppercase tracking-widest"
                      >
                        Get from GitHub
                      </a>
                    }
                  />
                  <InputWithAction
                    label="GitHub Client Secret"
                    type="password"
                    value={config.githubClientSecret}
                    onChange={(val) => setConfig({ ...config, githubClientSecret: val })}
                    placeholder="Optional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputWithAction
                    label="JWT Secret"
                    type="password"
                    value={config.jwtSecret}
                    onChange={(val) => setConfig({ ...config, jwtSecret: val })}
                    onGenerate={() => handleGenerate('jwtSecret', 64)}
                    placeholder="Click Auto to generate"
                  />
                  <InputWithAction
                    label="Cookie Secret"
                    type="password"
                    value={config.cookieSecret}
                    onChange={(val) => setConfig({ ...config, cookieSecret: val })}
                    onGenerate={() => handleGenerate('cookieSecret', 64)}
                    placeholder="Click Auto to generate"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <InputWithAction
                    label="Encryption Key (32 char hex)"
                    type="password"
                    value={config.encryptionKey}
                    onChange={(val) => setConfig({ ...config, encryptionKey: val })}
                    onGenerate={() => handleGenerate('encryptionKey', 32, true)}
                    placeholder="Click Auto to generate"
                  />
                  <InputWithAction
                    label="Encryption Salt (64 char hex)"
                    type="password"
                    value={config.encryptionSalt}
                    onChange={(val) => setConfig({ ...config, encryptionSalt: val })}
                    onGenerate={() => handleGenerate('encryptionSalt', 64, true)}
                    placeholder="Click Auto to generate"
                  />
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
