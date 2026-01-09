'use client';

import { AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface StatsCardsProps {
  totalServices: number;
  activeServices: number;
  failedServices: number;
  translations: {
    stats: {
      total: string;
      active: string;
      failed: string;
    };
  };
}

export function StatsCards({
  totalServices,
  activeServices,
  failedServices,
  translations: t,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-lg">
            <Zap size={24} />
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1 leading-none">{totalServices}</div>
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              {t.stats.total}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1 leading-none">{activeServices}</div>
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              {t.stats.active}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-lg">
            <AlertCircle size={24} />
          </div>
          <div>
            <div className="text-4xl font-bold text-white mb-1 leading-none">{failedServices}</div>
            <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              {t.stats.failed}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
