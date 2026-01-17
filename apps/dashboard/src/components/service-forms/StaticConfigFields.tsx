import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const StaticConfigFields: React.FC<BaseConfigFieldsProps> = ({
  data,
  onChange,
  translations: t,
  disabled,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.buildCommand}
        </label>
        <input
          type="text"
          value={data.buildCommand || ''}
          onChange={(e) => onChange({ buildCommand: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="npm run build"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          Command to build your static assets
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.outputDir}
        </label>
        <input
          type="text"
          value={data.staticOutputDir || ''}
          onChange={(e) => onChange({ staticOutputDir: e.target.value })}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          placeholder="dist"
          disabled={disabled}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">
          The folder containing your built files
        </p>
      </div>

      <div className="space-y-2 opacity-50">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
          {t.labels.port}
        </label>
        <input
          type="number"
          value={80}
          readOnly
          className="w-full px-4 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:outline-none cursor-not-allowed font-medium"
          disabled={true}
        />
        <p className="text-[10px] text-slate-500 ml-1 italic">{t.newService.portStaticHint}</p>
      </div>
    </div>
  );
};
