import { useState } from 'react';
import {
  generatePrepareScript,
  generateRandomString,
  generateSetupScript,
  SetupConfig,
} from '../utils/script-generators';

export function useServerSetup() {
  const [config, setConfig] = useState<SetupConfig>({
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
    branch: 'main',
    helvetiaAdmin: 'admin',
    helvetiaAdminPassword: '',
  });

  const [activeTab, setActiveTab] = useState<'prepare' | 'setup'>('prepare');
  const [importMode, setImportMode] = useState<'fields' | 'bulk'>('fields');
  const [copied, setCopied] = useState(false);

  const updateConfig = (updates: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleGenerate = (key: keyof SetupConfig, length = 32, hex = false) => {
    updateConfig({ [key]: generateRandomString(length, hex) });
  };

  const handleBulkImport = (text: string) => {
    const lines = text.split('\n');
    const newConfig: Partial<SetupConfig> = {};

    const mapping: Record<string, keyof SetupConfig> = {
      DOMAIN_NAME: 'domain',
      ACME_EMAIL: 'email',
      POSTGRES_PASSWORD: 'postgresPassword',
      GRAFANA_PASSWORD: 'grafanaPassword',
      GITHUB_CLIENT_ID: 'githubClientId',
      GITHUB_CLIENT_SECRET: 'githubClientSecret',
      JWT_SECRET: 'jwtSecret',
      COOKIE_SECRET: 'cookieSecret',
      ENCRYPTION_KEY: 'encryptionKey',
      ENCRYPTION_SALT: 'encryptionSalt',
      HELVETIA_ADMIN: 'helvetiaAdmin',
      HELVETIA_ADMIN_PASSWORD: 'helvetiaAdminPassword',
    };

    lines.forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      const configKey = mapping[key.trim()];
      if (configKey && value) {
        newConfig[configKey] = value;
      }
    });

    updateConfig(newConfig);
  };

  const handleCopy = () => {
    const script = activeTab === 'prepare' ? generatePrepareScript() : generateSetupScript(config);
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentScript =
    activeTab === 'prepare' ? generatePrepareScript() : generateSetupScript(config);

  return {
    config,
    updateConfig,
    activeTab,
    setActiveTab,
    importMode,
    setImportMode,
    handleBulkImport,
    copied,
    handleGenerate,
    handleCopy,
    currentScript,
  };
}
