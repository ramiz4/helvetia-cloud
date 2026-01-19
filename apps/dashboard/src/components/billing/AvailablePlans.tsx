'use client';

import { PlanCard } from '@/components/billing/PlanCard';
import { PLANS } from '@/lib/plans';
import type { PlanDetails } from '@/types/billing';
import { TrendingUp } from 'lucide-react';

interface AvailablePlansProps {
  currentPlan?: string;
  onSelect: (plan: PlanDetails) => void;
  isLoading?: boolean;
}

export function AvailablePlans({ currentPlan, onSelect, isLoading }: AvailablePlansProps) {
  return (
    <div className="mb-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <TrendingUp size={24} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Available Plans</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Choose the plan that fits your needs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.name}
            plan={plan}
            currentPlan={currentPlan}
            onSelect={onSelect}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
