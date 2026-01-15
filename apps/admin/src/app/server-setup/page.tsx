'use client';

import { Server } from 'lucide-react';
import { ConfigurationForm } from './components/ConfigurationForm';
import { ScriptViewer } from './components/ScriptViewer';
import { useServerSetup } from './hooks/useServerSetup';

export default function ServerSetupPage() {
  const {
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
  } = useServerSetup();

  return (
    <div className="min-h-screen bg-slate-950 py-8 animate-fade-in text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
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
          <ConfigurationForm
            config={config}
            updateConfig={updateConfig}
            handleGenerate={handleGenerate}
            importMode={importMode}
            setImportMode={setImportMode}
            onBulkImport={handleBulkImport}
          />

          <ScriptViewer
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentScript={currentScript}
            handleCopy={handleCopy}
            copied={copied}
          />
        </div>
      </div>
    </div>
  );
}
