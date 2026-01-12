import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const ComposeConfigFields: React.FC<BaseConfigFieldsProps> = ({
  data,
  onChange,
  translations: t,
  disabled,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.newService.composeFile}
        </label>
        <input
          type="text"
          value={data.buildCommand || ''} // Reusing buildCommand as composeFile path
          onChange={(e) => onChange({ buildCommand: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="docker-compose.yml"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          Path to your docker-compose file in the repo
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.newService.mainServiceName}
        </label>
        <input
          type="text"
          value={data.startCommand || ''} // Reusing startCommand as main service name
          onChange={(e) => onChange({ startCommand: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="app"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          {t.dashboard.newService.mainServiceDesc}
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.dashboard.labels.port}
        </label>
        <input
          type="number"
          value={data.port || 8080}
          onChange={(e) => onChange({ port: parseInt(e.target.value) })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">Port of the main service to expose</p>
      </div>
    </div>
  );
};
