import React from 'react';
import { BaseConfigFieldsProps } from './types';

export const DatabaseConfigFields: React.FC<BaseConfigFieldsProps> = ({ translations: t }) => {
  return (
    <div className="p-8 border border-dashed border-white/10 rounded-2xl bg-white/5 flex flex-col items-center justify-center text-center">
      <p className="text-slate-400 font-medium">{t.dashboard.newService.databaseEngine}</p>
      <p className="text-[10px] text-slate-500 mt-2 italic">
        Managed databases are configured automatically.
      </p>
    </div>
  );
};
