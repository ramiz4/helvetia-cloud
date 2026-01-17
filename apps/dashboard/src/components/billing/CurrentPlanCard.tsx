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
        return 'text-emerald-400 bg-emerald-500/10';
      case 'PAST_DUE':
        return 'text-amber-400 bg-amber-500/10';
      case 'CANCELED':
        return 'text-slate-400 bg-slate-500/10';
      case 'UNPAID':
        return 'text-rose-400 bg-rose-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
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
    <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Shield size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Current Plan</h3>
            <p className="text-slate-400 text-sm mt-1">Your active subscription</p>
          </div>
        </div>
        <span
          className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(subscription.status)}`}
        >
          {subscription.status}
        </span>
      </div>

      <div className="space-y-6 mb-8">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Plan</span>
          </div>
          <span className="text-2xl font-bold text-white">{subscription.plan}</span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-slate-400" />
            <span className="text-slate-400 font-medium">Current Period</span>
          </div>
          <span className="text-sm font-medium text-white">
            {formatDate(subscription.currentPeriodStart)} -{' '}
            {formatDate(subscription.currentPeriodEnd)}
          </span>
        </div>
      </div>

      <button
        onClick={onManage}
        disabled={loading}
        className={`w-full px-6 py-4 rounded-2xl font-bold bg-white/10 text-white hover:bg-white/20 transition-all shadow-xl active:scale-95 ${loading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {loading ? 'Loading...' : 'Manage Subscription'}
      </button>
    </div>
  );
}
