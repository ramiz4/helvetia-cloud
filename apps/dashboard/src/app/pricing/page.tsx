'use client';

import { AvailablePlans } from '@/components/billing/AvailablePlans';
import { useSubscription } from '@/hooks/useBilling';
import type { PlanDetails } from '@/types/billing';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { checkAndRefreshToken } from 'shared-ui';

export default function PricingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const { data: subscription } = useSubscription({ enabled: !!isAuthenticated });

  useEffect(() => {
    const initAuth = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const refreshed = await checkAndRefreshToken();
        setIsAuthenticated(refreshed);
      } else {
        setIsAuthenticated(false);
      }
    };
    initAuth();
  }, []);

  const handleSelectPlan = (plan: PlanDetails) => {
    if (!isAuthenticated) {
      toast.error('Please login or sign up to select a plan.');
      router.push('/login?callbackUrl=/billing');
      return;
    }

    // If authenticated, redirect to billing page to handle checkout/confirmation
    router.push('/billing');
  };

  return (
    <div className="py-12 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-slate-900 dark:text-white">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-slate-900 dark:text-white">
          Simple, Transparent <span className="text-indigo-600 dark:text-indigo-400">Pricing</span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xl font-medium max-w-2xl mx-auto">
          Choose the perfect plan for your business. Whether you&apos;re just starting out or
          scaling to millions of users, we have you covered.
        </p>
      </div>

      <AvailablePlans currentPlan={subscription?.plan} onSelect={handleSelectPlan} />

      <div className="mt-20 p-12 rounded-[40px] bg-linear-to-br from-indigo-600 to-violet-700 dark:from-indigo-500/10 dark:to-indigo-500/5 border border-transparent dark:border-indigo-500/20 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-indigo-500/20 blur-[100px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 dark:bg-indigo-500/20 blur-[100px] -ml-32 -mb-32 transition-transform duration-1000 group-hover:scale-110" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Need something custom?
            </h2>
            <p className="text-indigo-100 dark:text-slate-300 text-lg max-w-xl">
              We offer tailored solutions for large enterprises with specific security, compliance,
              and support requirements.
            </p>
          </div>
          <button className="px-8 py-4 rounded-2xl font-bold bg-white text-indigo-600 dark:text-slate-900 hover:bg-slate-50 transition-all shadow-xl hover:shadow-2xl active:scale-95 whitespace-nowrap">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
}
