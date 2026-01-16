'use client';

import { CheckCircle2, Lock, Shield, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { GITHUB_CLIENT_ID, useLanguage } from 'shared-ui';
import { GithubIcon } from '../../components/icons/GithubIcon';

function LoginContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const error = errorParam === 'code_expired' ? t.login.codeExpired : errorParam;
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      console.error('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
      return;
    }

    setIsLoading(true);
    const redirectUri = `${window.location.origin}/auth/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user,repo,read:org,read:packages`;

    window.location.href = githubUrl;
  };

  const benefits = [
    {
      icon: <Zap size={18} className="text-indigo-400" />,
      text: 'Deploy in seconds with Git integration',
    },
    {
      icon: <Shield size={18} className="text-emerald-400" />,
      text: 'Hosted 100% in Switzerland',
    },
    {
      icon: <Lock size={18} className="text-blue-400" />,
      text: 'Enterprise-grade security & privacy',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Skip to main content for accessibility */}
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-500 focus:text-white focus:rounded-lg"
      >
        Skip to login form
      </a>

      {/* Background decoration */}
      <div
        className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-md" role="main">
        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-lg px-2 py-1 -ml-2"
          aria-label="Back to home page"
        >
          <span
            className="mr-2 transform group-hover:-translate-x-1 transition-transform"
            aria-hidden="true"
          >
            ←
          </span>
          {t.login.backToHome}
        </Link>

        {/* Main login card */}
        <article
          id="login-form"
          className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
          role="region"
          aria-label="Login form"
        >
          {/* Top accent bar */}
          <div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500"
            aria-hidden="true"
          />

          {/* Header with logo and title */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative w-20 h-20 mb-6">
              <div
                className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl"
                aria-hidden="true"
              />
              <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Image
                  src="/logo.png"
                  alt="Helvetia Cloud Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
              {t.login.swissCloudSecurity}
            </h1>
            <p className="text-slate-400 leading-relaxed text-base sm:text-lg">
              {t.login.securityDesc}
            </p>
          </div>

          {/* Key benefits */}
          <div className="mb-8 space-y-3" role="list" aria-label="Platform benefits">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/[0.07] transition-colors"
                role="listitem"
              >
                <div className="mt-0.5 shrink-0" aria-hidden="true">
                  {benefit.icon}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{benefit.text}</p>
              </div>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2"
              role="alert"
              aria-live="assertive"
            >
              <div className="flex items-start gap-3">
                <div
                  className="p-1 bg-red-500/20 rounded-lg text-red-500 mt-0.5"
                  aria-hidden="true"
                >
                  <span className="text-xs font-bold font-mono">!</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-400 mb-1">{t.login.authError}</div>
                  <div className="text-xs text-red-400/80 leading-relaxed">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* GitHub login button */}
          <div className="space-y-4">
            <button
              onClick={handleGitHubLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-4 px-8 py-5 rounded-[24px] font-bold bg-white text-slate-950 hover:bg-slate-50 disabled:bg-slate-200 disabled:cursor-not-allowed transition-all hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.2)] active:scale-95 group/btn overflow-hidden relative focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              aria-label="Sign in with GitHub"
            >
              {isLoading ? (
                <>
                  <div
                    className="w-6 h-6 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-xl">{t.login.authenticating}</span>
                </>
              ) : (
                <>
                  <GithubIcon size={24} aria-hidden="true" />
                  <span className="text-xl">{t.login.continueWithGithub}</span>
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-shimmer pointer-events-none"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>

            {/* Organization access help */}
            <div
              className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3 items-start"
              role="note"
              aria-label="GitHub organization access information"
            >
              <div
                className="p-1 bg-indigo-500/20 rounded-lg text-indigo-400 mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <Shield size={14} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                {t.login.orgAccessHelp}
              </p>
            </div>

            {/* Security and privacy message */}
            <div
              className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex gap-3 items-start"
              role="note"
              aria-label="Security information"
            >
              <div
                className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400 mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <CheckCircle2 size={14} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your data is encrypted and stored in Switzerland. We never access your repositories
                without permission.
              </p>
            </div>

            {/* Terms and Privacy */}
            <div className="mt-8 text-center pt-4 border-t border-white/5">
              <p className="text-slate-500 text-xs font-semibold">
                {t.login.termsPrivacy.split('{terms}')[0]}
                <a
                  href="#"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                  aria-label="Terms of Service"
                >
                  {t.login.terms}
                </a>
                {' & '}
                <a
                  href="#"
                  className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                  aria-label="Privacy Policy"
                >
                  {t.login.privacy}
                </a>
              </p>
            </div>
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
            <div className="w-12 h-px bg-white/5" aria-hidden="true" />
            <span>{t.login.builtBy}</span>
            <div className="w-12 h-px bg-white/5" aria-hidden="true" />
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[80vh] flex items-center justify-center"
          role="status"
          aria-label="Loading login page"
        >
          <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
          <span className="sr-only">Loading...</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
