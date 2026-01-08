'use client';

import { API_BASE_URL } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { BookOpen, LayoutDashboard, LogIn, Plus } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ username: string; avatarUrl?: string } | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  // Check login status on mount and when interactions occur
  useEffect(() => {
    const checkLogin = () => {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setIsLoggedIn(true);
        try {
          setUser(JSON.parse(userStr));
        } catch (e) {
          console.error('Failed to parse user from localStorage', e);
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    checkLogin();

    // Listen for storage events (e.g. logging out in another tab)
    window.addEventListener('storage', checkLogin);
    return () => window.removeEventListener('storage', checkLogin);
  }, [pathname]); // Also re-check on route change if needed

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        alert(t.nav.logoutFailed || 'Logout failed on server, but you will be logged out locally.');
      }
    } catch (e) {
      console.error('Logout failed', e);
      alert(
        t.nav.logoutNetworkError ||
          'Network error during logout, but you will be logged out locally.',
      );
    } finally {
      localStorage.removeItem('user');
      // Remove legacy tokens just in case
      localStorage.removeItem('token');
      localStorage.removeItem('gh_token');
      setIsLoggedIn(false);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      {/* Liquid Glass Background Layer */}
      <div
        className="absolute inset-0 -z-10 border-b border-white/10 shadow-2xl overflow-hidden"
        style={{
          background:
            'linear-gradient(-45deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
          backgroundSize: '400% 400%',
          animation: 'liquid-gradient 15s ease infinite',
          backdropFilter: 'blur(50px) saturate(210%) brightness(1.1)',
          WebkitBackdropFilter: 'blur(50px) saturate(210%) brightness(1.1)',
          boxShadow:
            '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 1px rgba(255, 255, 255, 0.08), inset 0 -1px 0 0 rgba(255, 255, 255, 0.03)',
        }}
      />

      <div className="max-w-[1280px] mx-auto px-8 h-[70px] flex items-center justify-between">
        <a
          href="/"
          className="flex items-center gap-3 font-bold text-xl text-white font-display tracking-tight"
          aria-label={t.nav.homeAria}
        >
          <Image
            src="/logo.png"
            alt={t.nav.logoAlt}
            width={32}
            height={32}
            className="rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          />
          <span className="flex items-center gap-2" aria-hidden="true">
            {t.nav.brand}
          </span>
        </a>

        {isLoggedIn && (
          <>
            <div className="flex gap-2">
              <a
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium transition-all ${
                  pathname === '/'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <LayoutDashboard size={18} />
                <span>{t.nav.dashboard}</span>
              </a>
              <a
                href="/deployments"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium transition-all ${
                  pathname === '/deployments'
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <BookOpen size={18} />
                <span>{t.nav.deployments}</span>
              </a>
            </div>

            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <a
                href="/new"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium cursor-pointer transition-all border border-transparent text-[14px] gap-2 bg-indigo-500 text-white shadow-lg hover:bg-indigo-600 hover:-translate-y-0.5 active:scale-95"
              >
                <Plus size={16} />
                <span>{t.nav.newService}</span>
              </a>
              {user && <UserMenu user={user} onLogout={handleLogout} />}
            </div>
          </>
        )}

        {!isLoggedIn && (
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <div className="w-px h-6 bg-white/10 mx-1" />
            <a
              href="/login"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium cursor-pointer transition-all border border-transparent text-[14px] gap-2 bg-indigo-500 text-white shadow-lg hover:bg-indigo-600 hover:-translate-y-0.5 active:scale-95"
            >
              <LogIn size={16} />
              <span>{t.nav.login}</span>
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
