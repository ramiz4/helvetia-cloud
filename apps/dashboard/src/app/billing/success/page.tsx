'use client';

import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="py-8 animate-fade-in max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[48px] text-center p-24 flex flex-col items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-emerald-500/10 to-transparent opacity-50" />

        <div className="w-24 h-24 bg-emerald-500/20 rounded-[32px] flex items-center justify-center relative z-10 ring-1 ring-emerald-400/50 shadow-3xl">
          <CheckCircle size={56} className="text-emerald-400" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-black text-white mb-6">Payment Successful!</h1>
          <p className="text-slate-300 text-xl mb-4 leading-relaxed font-medium">
            Thank you for your subscription. Your payment has been processed successfully.
          </p>
          <p className="text-slate-400 text-sm mb-12">
            {sessionId && `Session ID: ${sessionId.slice(0, 20)}...`}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/billing"
              className="inline-flex items-center justify-center px-12 py-6 rounded-[24px] font-black text-xl bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:-translate-y-2 shadow-2xl shadow-indigo-500/40 active:scale-95 gap-4"
            >
              View Billing Dashboard
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-12 py-6 rounded-[24px] font-black text-xl bg-white/10 text-white hover:bg-white/20 transition-all hover:-translate-y-2 shadow-2xl active:scale-95 gap-4"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
          <p className="text-slate-500 font-medium animate-pulse text-lg">Loading...</p>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
