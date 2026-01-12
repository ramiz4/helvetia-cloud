import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const GHCRConfigFields: React.FC<BaseConfigFieldsProps> = ({
  data,
  onChange,
  translations: t,
  disabled,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.newService.branch} (Tag)
        </label>
        <input
          type="text"
          value={data.branch || ''}
          onChange={(e) => onChange({ branch: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono text-sm"
          placeholder="latest"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">The Docker image tag to pull</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.newService.startCommand}
        </label>
        <input
          type="text"
          value={data.startCommand || ''}
          onChange={(e) => onChange({ startCommand: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono text-sm"
          placeholder="optional override"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          Optional: Override image ENTRYPOINT / CMD
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.labels.port}
        </label>
        <input
          type="number"
          value={data.port || ''}
          onChange={(e) =>
            onChange({ port: e.target.value ? parseInt(e.target.value) : undefined })
          }
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono text-sm"
          placeholder="8080"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">The port the container exposes</p>
      </div>
    </div>
  );
};
