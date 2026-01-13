'use client';

import { API_BASE_URL } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { Loader2, Lock, Shield } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function AdminLoginContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');

  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(errorParam || '');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLocalError('');

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (res.ok && data.user) {
        if (data.user.role !== 'ADMIN') {
          setLocalError('Access denied. Admin privileges required.');
          return;
        }
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/admin';
      } else {
        setLocalError(data.error || t.login.invalidCredentials);
      }
    } catch {
      setLocalError(t.common.apiError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
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
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-red-500 via-orange-500 to-red-500" />

          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/20">
              <Shield className="text-white" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {t.login.adminLogin}
            </h1>
            <p className="text-slate-400 leading-relaxed">
              Administrative access only. Authorized personnel required.
            </p>
          </div>

          {localError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-red-500/20 rounded-lg text-red-500 mt-0.5">
                  <span className="text-xs font-bold font-mono">!</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-400 mb-1">{t.login.authError}</div>
                  <div className="text-xs text-red-400/80 leading-relaxed">{localError}</div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.login.username}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t.login.username}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.login.password}
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={t.login.password}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Lock size={20} />
                  {t.login.signIn}
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center pt-4 border-t border-white/5">
            <p className="text-slate-500 text-xs font-semibold">
              This is a restricted area. All access attempts are logged and monitored.
            </p>
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

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-white/10 border-t-red-500 rounded-full animate-spin-fast" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
