'use client';

import { CheckCircle2, Lock, Mail, Shield, User, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL, GITHUB_CLIENT_ID, useLanguage } from 'shared-ui';
import { GithubIcon } from '../../components/icons/GithubIcon';

function SignupContent() {
  const { t } = useLanguage();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubLogin = () => {
    if (!GITHUB_CLIENT_ID) {
      console.error('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user,repo,read:org,read:packages`;

    window.location.href = githubUrl;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!username || username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = '/auth/register';
      const body = { email, password, username };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Account created successfully!');
        router.push('/services');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    {
      id: 'deploy-git',
      icon: <Zap size={18} className="text-indigo-400" />,
      text: t.login.benefit1,
    },
    {
      id: 'hosted-switzerland',
      icon: <Shield size={18} className="text-emerald-400" />,
      text: t.login.benefit2,
    },
    {
      id: 'enterprise-security',
      icon: <Lock size={18} className="text-blue-400" />,
      text: t.login.benefit3,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Skip to main content for accessibility */}
      <a
        href="#signup-form"
        className="fixed left-4 top-4 z-50 -translate-y-20 transform bg-indigo-500 text-white px-4 py-2 rounded-lg focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Skip to signup form
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

      <div className="w-full max-w-md">
        {/* Back to home link */}
        <Link
          href="/"
          className="inline-flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-8 transition-colors group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-lg px-2 py-1 -ml-2"
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

        {/* Main signup card */}
        <main>
          <div
            id="signup-form"
            className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden"
            role="region"
            aria-label="Signup form"
          >
            {/* Top accent bar */}
            <div
              className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-indigo-500 via-blue-500 to-indigo-500"
              aria-hidden="true"
            />

            {/* Header with logo and title */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative w-20 h-20 mb-6">
                <div
                  className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl"
                  aria-hidden="true"
                />
                <div className="relative w-full h-full bg-linear-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
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
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                Create an Account
              </h1>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-base sm:text-lg">
                Start building with the most secure Swiss cloud.
              </p>
            </div>

            {/* Key benefits */}
            <div className="mb-8 space-y-3" role="list" aria-label="Platform benefits">
              {benefits.map((benefit) => (
                <div
                  key={benefit.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors"
                  role="listitem"
                >
                  <div className="mt-0.5 shrink-0" aria-hidden="true">
                    {benefit.icon}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {benefit.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Signup Form */}
            <form onSubmit={handleRegister} className="space-y-4 mb-6">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >
                  Username
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    required
                    minLength={3}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-indigo-300 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <Link
                href="/login"
                className="block text-center w-full text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 font-semibold transition-colors mt-4"
              >
                Already have an account? Sign in
              </Link>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-slate-900/50 text-slate-500 font-semibold">
                  Or continue with
                </span>
              </div>
            </div>

            {/* GitHub login button */}
            <div className="space-y-4">
              <button
                onClick={handleGitHubLogin}
                className="w-full flex items-center justify-center gap-4 px-8 py-5 rounded-[24px] font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-50 transition-all hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.3)] dark:hover:shadow-[0_20px_40px_-15px_rgba(255,255,255,0.2)] active:scale-95 group/btn overflow-hidden relative focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                aria-label="Sign in with GitHub"
              >
                <GithubIcon size={24} aria-hidden="true" />
                <span className="text-xl">{t.login.continueWithGithub}</span>
                <div
                  className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-shimmer pointer-events-none"
                  aria-hidden="true"
                />
              </button>

              {/* Organization access help */}
              <div
                className="p-4 bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl flex gap-3 items-start"
                role="note"
                aria-label="GitHub organization access information"
              >
                <div
                  className="p-1 bg-indigo-500/20 rounded-lg text-indigo-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <Shield size={14} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                  {t.login.orgAccessHelp}
                </p>
              </div>

              {/* Security and privacy message */}
              <div
                className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-2xl flex gap-3 items-start"
                role="note"
                aria-label="Security information"
              >
                <div
                  className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <CheckCircle2 size={14} />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.login.dataSecurityMessage}
                </p>
              </div>

              {/* Terms and Privacy */}
              <div className="mt-8 text-center pt-4 border-t border-slate-100 dark:border-white/5">
                <p className="text-slate-500 text-xs font-semibold">
                  {t.login.termsPrivacy.split('{terms}')[0]}
                  <Link
                    href="/terms"
                    className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                    aria-label="Terms of Service"
                  >
                    {t.login.terms}
                  </Link>
                  {' & '}
                  <Link
                    href="/privacy"
                    className="text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                    aria-label="Privacy Policy"
                  >
                    {t.login.privacy}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </main>

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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-[80vh] flex items-center justify-center"
          role="status"
          aria-label="Loading signup page"
        >
          <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
          <span className="sr-only">Loading...</span>
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
