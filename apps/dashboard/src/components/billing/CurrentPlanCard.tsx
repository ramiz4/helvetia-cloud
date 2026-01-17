'use client';

import type { Subscription } from '@/types/billing';
import { Calendar, CreditCard, Shield } from 'lucide-react';

interface CurrentPlanCardProps {
  subscription: Subscription;
  onManage: () => void;
  loading?: boolean;
}

export function CurrentPlanCard({ subscription, onManage, loading }: CurrentPlanCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10';
      case 'PAST_DUE':
        return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/10';
      case 'CANCELED':
        return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-500/10';
      case 'UNPAID':
        return 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-500/10';
      default:
        return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-500/10';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Shield size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Current Plan</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Your active subscription
            </p>
          </div>
        </div>
        <span
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(subscription.status)}`}
        >
          {subscription.status}
        </span>
      </div>

      <div className="space-y-6 mb-8">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-slate-500 dark:text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Plan</span>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {subscription.plan}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-slate-500 dark:text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Current Period</span>
          </div>
          <span className="text-sm font-medium text-slate-900 dark:text-white">
            {formatDate(subscription.currentPeriodStart)} -{' '}
            {formatDate(subscription.currentPeriodEnd)}
          </span>
        </div>
      </div>

      <button
        onClick={onManage}
        disabled={loading}
        className={`w-full px-6 py-4 rounded-2xl font-bold bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all shadow-xl active:scale-95 ${loading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {loading ? 'Loading...' : 'Manage Subscription'}
      </button>
    </div>
  );
}
