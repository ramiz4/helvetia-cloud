'use client';

import { GITHUB_CLIENT_ID } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { GithubIcon } from '../../components/icons/GithubIcon';

function LoginContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const error = errorParam === 'code_expired' ? t.login.codeExpired : errorParam;

  const handleGitHubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      console.error('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user,repo,read:org`;

    window.location.href = githubUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors group"
        >
          <span className="mr-2 transform group-hover:-translate-x-1 transition-transform">←</span>
          {t.login.backToHome}
        </Link>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-indigo-500 via-blue-500 to-indigo-500" />

          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/20">
              <Shield className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {t.login.swissCloudSecurity}
            </h1>
            <p className="text-slate-400 leading-relaxed">{t.login.securityDesc}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-red-500/20 rounded-lg text-red-500 mt-0.5">
                  <span className="text-xs font-bold font-mono">!</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-400 mb-1">{t.login.authError}</div>
                  <div className="text-xs text-red-400/80 leading-relaxed">{error}</div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGitHubLogin}
              className="w-full flex items-center justify-center gap-4 px-8 py-5 rounded-[24px] font-bold bg-white text-slate-950 hover:bg-slate-50 transition-all hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.2)] active:scale-95 group/btn overflow-hidden relative"
            >
              <GithubIcon size={24} />
              <span className="text-xl">{t.login.continueWithGithub}</span>
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-shimmer pointer-events-none" />
            </button>

            <div className="mt-8 text-center">
              <p className="text-slate-500 text-sm font-semibold">
                {t.login.termsPrivacy.split('{terms}')[0]}
                <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  {t.login.terms}
                </a>{' '}
                &{' '}
                <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                  {t.login.privacy}
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Swiss Made */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex items-center gap-3 text-slate-500 font-bold text-[10px] uppercase tracking-[0.3em]">
            <div className="w-12 h-px bg-white/5" />
            <span>{t.login.builtBy}</span>
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
