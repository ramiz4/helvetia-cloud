'use client';

import type { Usage } from '@/types/billing';
import { Activity, Database, HardDrive, Network } from 'lucide-react';

interface UsageMetricsProps {
  usage: Usage;
}

export function UsageMetrics({ usage }: UsageMetricsProps) {
  const getIcon = (metric: string) => {
    switch (metric) {
      case 'COMPUTE_HOURS':
        return <Activity size={24} className="text-indigo-600 dark:text-indigo-400" />;
      case 'MEMORY_GB_HOURS':
        return <Database size={24} className="text-purple-600 dark:text-purple-400" />;
      case 'BANDWIDTH_GB':
        return <Network size={24} className="text-cyan-600 dark:text-cyan-400" />;
      case 'STORAGE_GB':
        return <HardDrive size={24} className="text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Activity size={24} className="text-slate-400 dark:text-slate-400" />;
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'COMPUTE_HOURS':
        return 'Compute Hours';
      case 'MEMORY_GB_HOURS':
        return 'Memory (GB·hours)';
      case 'BANDWIDTH_GB':
        return 'Bandwidth (GB)';
      case 'STORAGE_GB':
        return 'Storage (GB)';
      default:
        return metric;
    }
  };

  const formatQuantity = (quantity: number, metric: string) => {
    if (metric === 'BANDWIDTH_GB' || metric === 'STORAGE_GB') {
      return quantity.toFixed(2);
    }
    return quantity.toFixed(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Usage Metrics</h3>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {formatDate(usage.periodStart)} - {formatDate(usage.periodEnd)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {usage.usage.map((metric) => (
          <div
            key={metric.metric}
            className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-white/5 flex items-center justify-center">
                {getIcon(metric.metric)}
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                ${metric.cost.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {getMetricLabel(metric.metric)}
              </h4>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {formatQuantity(metric.quantity, metric.metric)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {usage.usage.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-600 dark:text-slate-400 font-medium">
            No usage data available for this period
          </p>
        </div>
      )}
    </div>
  );
}
