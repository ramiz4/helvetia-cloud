import { Check, Copy, ShieldCheck, Terminal } from 'lucide-react';
import React from 'react';

interface ScriptViewerProps {
  activeTab: 'prepare' | 'setup';
  setActiveTab: (tab: 'prepare' | 'setup') => void;
  currentScript: string;
  handleCopy: () => void;
  copied: boolean;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({
  activeTab,
  setActiveTab,
  currentScript,
  handleCopy,
  copied,
}) => {
  return (
    <div className="bg-slate-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Tab Header */}
      <div className="bg-slate-900/80 border-b border-white/10 p-1 flex">
        <button
          onClick={() => setActiveTab('prepare')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all rounded-t-2xl ${
            activeTab === 'prepare'
              ? 'bg-slate-950 text-blue-400 border-t border-x border-white/10'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <ShieldCheck size={16} />
          1. PREPARE SERVER
        </button>
        <button
          onClick={() => setActiveTab('setup')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-all rounded-t-2xl ${
            activeTab === 'setup'
              ? 'bg-slate-950 text-blue-400 border-t border-x border-white/10'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Terminal size={16} />
          2. SETUP APP
        </button>
      </div>

      <div className="bg-slate-900/40 px-6 py-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal size={18} className="text-blue-500" />
          <span className="font-mono text-xs uppercase tracking-widest font-bold">
            {activeTab === 'prepare' ? 'prepare.sh' : 'setup.sh'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all text-xs font-bold text-blue-400 border border-blue-500/20"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {copied ? 'COPIED!' : 'COPY SCRIPT'}
        </button>
      </div>

      {/* Usage Helper - Now at the Top */}
      <div className="bg-slate-900 border-b border-white/5 p-4 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-black/40 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-tight">
              1. Create file
            </span>
            <code className="text-[10px] text-blue-300 block truncate">
              nano {activeTab === 'prepare' ? 'prepare.sh' : 'setup.sh'}
            </code>
          </div>
          <div className="bg-black/40 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-tight">
              2. Permissions
            </span>
            <code className="text-[10px] text-blue-300 block truncate">
              chmod +x {activeTab === 'prepare' ? 'prepare.sh' : 'setup.sh'}
            </code>
          </div>
          <div className="bg-black/40 rounded-xl p-2 border border-white/5">
            <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-tight">
              3. Run
            </span>
            <code className="text-[10px] text-green-400 block truncate">
              ./{activeTab === 'prepare' ? 'prepare.sh' : 'setup.sh'}
            </code>
          </div>
        </div>
      </div>

      <div className="flex-1 p-0 overflow-hidden relative flex flex-col">
        <textarea
          readOnly
          value={currentScript}
          className="flex-1 bg-slate-950 p-6 font-mono text-[13px] leading-relaxed text-slate-400 focus:outline-none resize-none scrollbar-thin scrollbar-thumb-white/10"
          style={{ minHeight: '500px' }}
        />
      </div>
    </div>
  );
};
