'use client';

import { CurrentPlanCard } from '@/components/billing/CurrentPlanCard';
import { InvoiceList } from '@/components/billing/InvoiceList';
import { PlanCard } from '@/components/billing/PlanCard';
import { UsageMetrics } from '@/components/billing/UsageMetrics';
import { useCheckout, useInvoices, usePortal, useSubscription, useUsage } from '@/hooks/useBilling';
import { PLANS } from '@/lib/plans';
import type { PlanDetails } from '@/types/billing';
import { AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { checkAndRefreshToken, ConfirmationModal } from 'shared-ui';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function BillingPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetails | null>(null);
  const [showPlanConfirm, setShowPlanConfirm] = useState(false);

  // Fetch data
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    isError: subscriptionError,
  } = useSubscription({ enabled: !!isAuthenticated });

  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    isError: invoicesError,
  } = useInvoices({ enabled: !!isAuthenticated && !!subscription });

  const {
    data: usage,
    isLoading: usageLoading,
    isError: usageError,
  } = useUsage({ enabled: !!isAuthenticated && !!subscription });

  // Mutations
  const checkoutMutation = useCheckout();
  const portalMutation = usePortal();

  // Check authentication
  useEffect(() => {
    const initAuth = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const refreshed = await checkAndRefreshToken();
        setIsAuthenticated(refreshed);
        if (!refreshed) {
          localStorage.removeItem('user');
          router.push('/login');
        }
      } else {
        setIsAuthenticated(false);
        router.push('/login');
      }
    };

    initAuth();
  }, [router]);

  // Handle plan selection
  const handleSelectPlan = (plan: PlanDetails) => {
    if (plan.name === 'FREE') {
      toast.error('Cannot downgrade to free plan from this page. Please use the billing portal.');
      return;
    }

    if (!plan.priceId) {
      toast.error('This plan is not available for purchase yet.');
      return;
    }

    setSelectedPlan(plan);
    setShowPlanConfirm(true);
  };

  // Handle plan change confirmation
  const handleConfirmPlanChange = async () => {
    if (!selectedPlan) return;

    try {
      const { url } = await checkoutMutation.mutateAsync({
        priceId: selectedPlan.priceId,
        plan: selectedPlan.name,
      });

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
      setShowPlanConfirm(false);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    try {
      const { url } = await portalMutation.mutateAsync();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to create portal session:', error);
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  // Loading state
  if (isAuthenticated === null || subscriptionLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 dark:border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
        <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse text-lg">
          Loading billing...
        </p>
      </div>
    );
  }

  // Error state
  if (subscriptionError) {
    return (
      <div className="py-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-rose-50 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 rounded-[32px] p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center mb-6">
            <AlertCircle size={32} className="text-rose-600 dark:text-rose-400" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Unable to Load Billing
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-lg mb-8">
            We encountered an error loading your billing information. Please try refreshing the
            page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 rounded-2xl font-bold bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-all shadow-xl active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="py-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-5xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white">
            Billing & Usage
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">
            Manage your subscription, view usage, and access invoices.
          </p>
        </div>

        {/* Current Plan & Usage */}
        {subscription && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            <CurrentPlanCard
              subscription={subscription}
              onManage={handleManageSubscription}
              loading={portalMutation.isPending}
            />

            {!usageLoading && !usageError && usage && <UsageMetrics usage={usage} />}
            {usageLoading && (
              <div className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto border-4 border-slate-200 dark:border-white/10 border-t-indigo-500 rounded-full animate-spin-fast mb-4" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Loading usage...</p>
                </div>
              </div>
            )}
            {usageError && !usageLoading && (
              <div className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-rose-200 dark:border-rose-500/20 shadow-2xl">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <AlertCircle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                      Unable to load usage
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      We couldn&apos;t load your usage metrics right now. Please try again later.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Subscription State */}
        {!subscription && !subscriptionLoading && (
          <div className="mb-16 p-8 rounded-[32px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  No Active Subscription
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  You are currently not subscribed to any plan. Choose a plan below to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Available Plans */}
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
                currentPlan={subscription?.plan}
                onSelect={handleSelectPlan}
                loading={checkoutMutation.isPending}
              />
            ))}
          </div>
        </div>

        {/* Invoices */}
        {!invoicesLoading && !invoicesError && invoices && invoices.length > 0 && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <CreditCard size={24} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Billing History
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  View and download your invoices
                </p>
              </div>
            </div>
            <InvoiceList invoices={invoices} />
          </div>
        )}
        {invoicesError && !invoicesLoading && subscription && (
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <CreditCard size={24} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Billing History
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  View and download your invoices
                </p>
              </div>
            </div>
            <div className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-rose-200 dark:border-rose-500/20 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <AlertCircle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Unable to load invoices
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">
                    We couldn&apos;t load your invoices right now. Please try again later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Plan Change Confirmation Modal */}
        {showPlanConfirm && selectedPlan && (
          <ConfirmationModal
            title={`Upgrade to ${selectedPlan.displayName}`}
            message={`You are about to upgrade to the ${selectedPlan.displayName} plan for $${selectedPlan.price}/${selectedPlan.interval}. You will be redirected to Stripe to complete the payment.`}
            confirmLabel="Continue to Checkout"
            onConfirm={handleConfirmPlanChange}
            onCancel={() => {
              setShowPlanConfirm(false);
              setSelectedPlan(null);
            }}
            isLoading={checkoutMutation.isPending}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
