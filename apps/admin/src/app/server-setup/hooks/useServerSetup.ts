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
  const [copied, setCopied] = useState(false);

  const updateConfig = (updates: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleGenerate = (key: keyof SetupConfig, length = 32, hex = false) => {
    updateConfig({ [key]: generateRandomString(length, hex) });
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
    copied,
    handleGenerate,
    handleCopy,
    currentScript,
  };
}
