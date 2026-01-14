'use client';

import { useFeatureFlag } from '@/lib/featureFlags';
import { Activity, AlertCircle, CheckCircle2, Clock, Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLanguage } from 'shared-ui';

export default function DeploymentsPage() {
  const { t } = useLanguage();
  const { enabled, loading } = useFeatureFlag('show-deployments');
  const router = useRouter();

  // Redirect if flag is disabled (security fallback)
  useEffect(() => {
    if (!loading && !enabled) {
      router.push('/');
    }
  }, [enabled, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!enabled) return null;

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2 flex items-center gap-3">
            <Rocket className="text-indigo-500" size={40} />
            {t.nav.deployments}
          </h1>
          <p className="text-slate-400 text-lg">
            Monitor and manage all application deployments across your projects.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[32px] p-12 text-center">
        <div className="w-20 h-20 bg-indigo-500/10 rounded-[24px] flex items-center justify-center text-indigo-400 mx-auto mb-6 border border-indigo-500/20 shadow-inner">
          <Activity size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Deployments View Coming Soon</h2>
        <p className="text-slate-400 max-w-md mx-auto mb-8">
          We are building a centralized dashboard to track all your deployments, build logs, and
          historical data in real-time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <Clock className="text-indigo-400 mb-3 mx-auto" />
            <span className="text-sm font-bold text-white block mb-1">History</span>
            <p className="text-xs text-slate-500">View past deployment attempts</p>
          </div>
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <CheckCircle2 className="text-emerald-400 mb-3 mx-auto" />
            <span className="text-sm font-bold text-white block mb-1">Rollbacks</span>
            <p className="text-xs text-slate-500">Easily revert to stable versions</p>
          </div>
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <AlertCircle className="text-rose-400 mb-3 mx-auto" />
            <span className="text-sm font-bold text-white block mb-1">Analytics</span>
            <p className="text-xs text-slate-500">Identify build performance bottlenecks</p>
          </div>
        </div>
      </div>
    </div>
  );
}
