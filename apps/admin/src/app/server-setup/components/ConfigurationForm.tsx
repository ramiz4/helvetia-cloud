import { Globe, Info } from 'lucide-react';
import React from 'react';
import { SetupConfig } from '../utils/script-generators';
import { InputWithAction } from './InputWithAction';

interface ConfigurationFormProps {
  config: SetupConfig;
  updateConfig: (updates: Partial<SetupConfig>) => void;
  handleGenerate: (key: keyof SetupConfig, length?: number, hex?: boolean) => void;
}

export const ConfigurationForm: React.FC<ConfigurationFormProps> = ({
  config,
  updateConfig,
  handleGenerate,
}) => {
  return (
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
            onChange={(val) => updateConfig({ domain: val })}
            placeholder="example.com"
          />

          <InputWithAction
            label="Admin Email (SSL)"
            value={config.email}
            onChange={(val) => updateConfig({ email: val })}
            placeholder="admin@example.com"
          />

          <InputWithAction
            label="Repository URL"
            value={config.repoUrl}
            onChange={(val) => updateConfig({ repoUrl: val })}
          />

          <InputWithAction
            label="Repository Branch"
            value={config.branch}
            onChange={(val) => updateConfig({ branch: val })}
          />

          <div className="grid grid-cols-2 gap-4">
            <InputWithAction
              label="Postgres Password"
              type="password"
              value={config.postgresPassword}
              onChange={(val) => updateConfig({ postgresPassword: val })}
              onGenerate={() => handleGenerate('postgresPassword')}
              placeholder="Click Auto to generate"
            />
            <InputWithAction
              label="Grafana Password"
              type="password"
              value={config.grafanaPassword}
              onChange={(val) => updateConfig({ grafanaPassword: val })}
              onGenerate={() => handleGenerate('grafanaPassword')}
              placeholder="Click Auto to generate"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputWithAction
              label="Dashboard Admin User"
              value={config.helvetiaAdmin}
              onChange={(val) => updateConfig({ helvetiaAdmin: val })}
            />
            <InputWithAction
              label="Dashboard Admin Password"
              type="password"
              value={config.helvetiaAdminPassword}
              onChange={(val) => updateConfig({ helvetiaAdminPassword: val })}
              onGenerate={() => handleGenerate('helvetiaAdminPassword')}
              placeholder="Click Auto to generate"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputWithAction
              label="GitHub Client ID"
              value={config.githubClientId}
              onChange={(val) => updateConfig({ githubClientId: val })}
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
              onChange={(val) => updateConfig({ githubClientSecret: val })}
              placeholder="Optional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputWithAction
              label="JWT Secret"
              type="password"
              value={config.jwtSecret}
              onChange={(val) => updateConfig({ jwtSecret: val })}
              onGenerate={() => handleGenerate('jwtSecret', 64)}
              placeholder="Click Auto to generate"
            />
            <InputWithAction
              label="Cookie Secret"
              type="password"
              value={config.cookieSecret}
              onChange={(val) => updateConfig({ cookieSecret: val })}
              onGenerate={() => handleGenerate('cookieSecret', 64)}
              placeholder="Click Auto to generate"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputWithAction
              label="Encryption Key (32 char hex)"
              type="password"
              value={config.encryptionKey}
              onChange={(val) => updateConfig({ encryptionKey: val })}
              onGenerate={() => handleGenerate('encryptionKey', 32, true)}
              placeholder="Click Auto to generate"
            />
            <InputWithAction
              label="Encryption Salt (64 char hex)"
              type="password"
              value={config.encryptionSalt}
              onChange={(val) => updateConfig({ encryptionSalt: val })}
              onGenerate={() => handleGenerate('encryptionSalt', 64, true)}
              placeholder="Click Auto to generate"
            />
          </div>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 p-6 rounded-3xl flex items-start gap-4">
        <Info className="text-blue-400 shrink-0 mt-1" size={20} />
        <div>
          <h3 className="font-bold text-blue-400 mb-1">Two-Step Deployment</h3>
          <ol className="list-decimal list-inside text-sm text-slate-400 space-y-2">
            <li>Provision a generic Linux VPS (Ubuntu 22.04 recommended).</li>
            <li>
              Run the <strong>Preparation Script</strong> first to harden security (Firewall, Swap,
              Docker).
            </li>
            <li>
              Setup DNS A records for <code>{config.domain}</code>, <code>api.{config.domain}</code>
              , and <code>monitor.{config.domain}</code>.
            </li>
            <li>
              Run the <strong>Application Setup</strong> script to deploy Helvetia Cloud.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
