import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const DockerConfigFields: React.FC<BaseConfigFieldsProps> = ({
  data,
  onChange,
  translations: t,
  disabled,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.buildCommand}
        </label>
        <input
          type="text"
          value={data.buildCommand || ''}
          onChange={(e) => onChange({ buildCommand: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="npm run build"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          Optional: Command to run before building the image
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.startCommand}
        </label>
        <input
          type="text"
          value={data.startCommand || ''}
          onChange={(e) => onChange({ startCommand: e.target.value })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="npm start"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">Command to start your application</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.port}
        </label>
        <input
          type="number"
          value={data.port || 3000}
          onChange={(e) => onChange({ port: parseInt(e.target.value) })}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          The port your application listens on
        </p>
      </div>
    </div>
  );
};
