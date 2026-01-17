'use client';

import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="py-8 animate-fade-in max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[48px] text-center p-24 flex flex-col items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-amber-500/10 to-transparent opacity-50" />

        <div className="w-24 h-24 bg-amber-500/20 rounded-[32px] flex items-center justify-center relative z-10 ring-1 ring-amber-400/50 shadow-3xl">
          <XCircle size={56} className="text-amber-400" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-black text-white mb-6">Checkout Canceled</h1>
          <p className="text-slate-300 text-xl mb-12 leading-relaxed font-medium">
            Your checkout was canceled. No charges were made to your account. Feel free to try again
            when you're ready.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/billing"
              className="inline-flex items-center justify-center px-12 py-6 rounded-[24px] font-black text-xl bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:-translate-y-2 shadow-2xl shadow-indigo-500/40 active:scale-95 gap-4"
            >
              Back to Billing
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
