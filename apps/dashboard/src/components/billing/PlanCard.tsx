'use client';

import type { PlanDetails } from '@/types/billing';
import { Check } from 'lucide-react';

interface PlanCardProps {
  plan: PlanDetails;
  currentPlan?: string;
  onSelect: (plan: PlanDetails) => void;
  loading?: boolean;
}

export function PlanCard({ plan, currentPlan, onSelect, loading }: PlanCardProps) {
  const isCurrent = currentPlan === plan.name;

  return (
    <div
      className={`p-8 rounded-[32px] backdrop-blur-xl border transition-all duration-500 shadow-2xl flex flex-col relative overflow-hidden ${
        plan.highlighted
          ? 'bg-indigo-500/10 border-indigo-500/50 scale-105'
          : 'bg-slate-900/40 border-white/10 hover:border-indigo-500/30'
      } ${isCurrent ? 'ring-2 ring-indigo-400' : ''}`}
    >
      {plan.highlighted && (
        <div className="absolute top-6 right-6 px-4 py-2 rounded-full bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
          Popular
        </div>
      )}

      {isCurrent && (
        <div className="absolute top-6 left-6 px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg">
          Current Plan
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-3xl font-bold text-white mb-2">{plan.displayName}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-black text-white tabular-nums">${plan.price}</span>
          <span className="text-slate-400 font-medium">/{plan.interval}</span>
        </div>
      </div>

      <ul className="space-y-4 mb-8 flex-grow">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3 text-slate-300">
            <div className="mt-0.5 flex-shrink-0">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Check size={14} className="text-indigo-400" />
              </div>
            </div>
            <span className="text-sm font-medium leading-relaxed">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan)}
        disabled={isCurrent || loading}
        className={`w-full px-6 py-4 rounded-2xl font-bold transition-all shadow-xl ${
          isCurrent
            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
            : plan.highlighted
              ? 'bg-indigo-500 text-white hover:bg-indigo-400 active:scale-95'
              : 'bg-white/10 text-white hover:bg-white/20 active:scale-95'
        } ${loading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {loading ? 'Processing...' : isCurrent ? 'Current Plan' : 'Select Plan'}
      </button>
    </div>
  );
}
