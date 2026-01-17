import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const GHCRConfigFields: React.FC<BaseConfigFieldsProps> = ({
  data,
  onChange,
  translations: translationsProp,
  disabled,
}) => {
  const t = translationsProp;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
          {t.newService.imageTag}
        </label>
        <input
          type="text"
          value={data.branch || ''}
          onChange={(e) => onChange({ branch: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono text-sm"
          placeholder="latest"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">The Docker image tag to pull</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.port}
        </label>
        <input
          type="number"
          value={data.port || ''}
          onChange={(e) =>
            onChange({ port: e.target.value ? parseInt(e.target.value) : undefined })
          }
          className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono text-sm"
          placeholder="8080"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">The port the container exposes</p>
      </div>
    </div>
  );
};
