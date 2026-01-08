'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { GithubIcon } from '../../components/icons/GithubIcon';
import { APP_BASE_URL } from '../../lib/config';

import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

function LoginContent() {
  const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const REDIRECT_URI = `${APP_BASE_URL}/auth/callback`;
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDetails = searchParams.get('details');

  const loginWithGitHub = () => {
    const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user,repo,read:org`;
    window.location.href = url;
  };

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-all mb-8 group"
        >
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-white/10 group-hover:bg-white/10 transition-all">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          </div>
          <span className="text-sm font-bold uppercase tracking-[0.2em]">Back to home</span>
        </Link>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 sm:p-12 shadow-2xl relative overflow-hidden group">
          {/* Animated subtle gradient highlight */}
          <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="relative z-10 text-center">
            <div className="relative inline-block mb-10">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
              <div className="relative w-24 h-24 bg-slate-950 rounded-[32px] flex items-center justify-center border border-white/10 shadow-2xl rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <ShieldCheck size={48} className="text-indigo-400" />
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
              Swiss Cloud Security
            </h1>
            <p className="text-slate-400 text-lg mb-12 leading-relaxed font-medium max-w-[280px] mx-auto">
              The high-performance platform for modern developers.
            </p>

            {error && (
              <div className="mb-10 p-5 bg-rose-500/5 border border-rose-500/20 rounded-[24px] flex items-start gap-4 text-left animate-in slide-in-from-top-2 duration-500">
                <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 shrink-0">
                  <AlertCircle className="text-rose-400" size={18} />
                </div>
                <div>
                  <div className="text-rose-400 font-bold text-xs uppercase tracking-widest mb-1.5">
                    Auth Error
                  </div>
                  <div className="text-slate-300 text-sm font-semibold leading-relaxed">
                    {error === 'bad_verification_code'
                      ? 'The authorization code has expired.'
                      : error}
                  </div>
                  {errorDetails && (
                    <div className="text-slate-500 text-xs mt-2 font-mono opacity-80">
                      {errorDetails}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={loginWithGitHub}
              className="w-full flex items-center justify-center gap-4 px-8 py-5 rounded-[24px] font-bold bg-white text-slate-950 hover:bg-slate-50 transition-all hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.2)] active:scale-95 group/btn overflow-hidden relative"
            >
              <GithubIcon size={24} />
              <span className="text-xl">Continue with GitHub</span>
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-shimmer pointer-events-none" />
            </button>

            <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
              <p className="text-slate-500 text-sm font-semibold">
                By continuing, you agree to our{' '}
                <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  Terms
                </a>{' '}
                &{' '}
                <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  Privacy
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Swiss Made */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
            <div className="w-12 h-px bg-white/5" />
            <span>Built by DeepMind Swiss 🇨🇭</span>
            <div className="w-12 h-px bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
