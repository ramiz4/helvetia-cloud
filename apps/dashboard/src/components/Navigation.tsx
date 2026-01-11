'use client';

import { API_BASE_URL } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { BookOpen, LayoutDashboard, LogIn, LogOut, Menu, Plus, Settings, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ username: string; avatarUrl?: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  }, [pathname]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

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
      setIsLoggedIn(false);
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-60 transition-all duration-300">
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @keyframes liquid-gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes slide-down {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `,
          }}
        />

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

        <div className="max-w-[1280px] mx-auto px-6 h-[70px] flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 font-bold text-xl text-white font-display tracking-tight z-50 shrink-0"
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
          </Link>

          {/* Desktop Navigation */}
          {isLoggedIn ? (
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex gap-2">
                <Link
                  href="/"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium transition-all ${
                    pathname === '/'
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <LayoutDashboard size={18} />
                  <span>{t.nav.dashboard}</span>
                </Link>
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
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-4">
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex lg:hidden items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 text-white z-50"
            aria-label={
              isMenuOpen ? t.nav.closeMenu || 'Close Menu' : t.nav.openMenu || 'Open Menu'
            }
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-55 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-menu"
            className="absolute top-[70px] left-0 right-0 max-h-[calc(100vh-70px)] bg-slate-900/90 border-b border-white/10 overflow-y-auto animate-in slide-in-from-top-4 duration-300 p-6 flex flex-col gap-6"
            role="navigation"
            aria-label={t.nav.mobileMenu || 'Mobile navigation'}
            style={{
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
            }}
          >
            {isLoggedIn ? (
              <>
                <div className="flex flex-col gap-2">
                  <Link
                    href="/"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[16px] font-medium transition-all ${
                      pathname === '/'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard size={20} />
                    <span>{t.nav.dashboard}</span>
                  </Link>
                  <a
                    href="/deployments"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[16px] font-medium transition-all ${
                      pathname === '/deployments'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <BookOpen size={20} />
                    <span>{t.nav.deployments}</span>
                  </a>
                  <a
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[16px] font-medium transition-all ${
                      pathname === '/settings'
                        ? 'bg-indigo-500/10 text-indigo-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Settings size={20} />
                    <span>{t.nav.settings}</span>
                  </a>
                </div>

                <div className="h-px bg-white/10" />

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 px-4">
                    <span className="text-slate-400 text-sm font-medium">
                      {t.nav.selectLanguage}
                    </span>
                    <LanguageSwitcher variant="minimal" />
                  </div>

                  <a
                    href="/new"
                    className="flex items-center justify-center px-4 py-3 rounded-xl font-semibold bg-indigo-500 text-white shadow-lg gap-2"
                  >
                    <Plus size={20} />
                    <span>{t.nav.newService}</span>
                  </a>

                  {user && (
                    <div className="flex items-center gap-4 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-indigo-500/20 border border-indigo-500/30">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.username}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-400">
                            <span className="text-lg font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-semibold">{user.username}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                          {t.common.freePlan}
                        </span>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="ml-auto p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                        aria-label={t.nav.logout}
                      >
                        <LogOut size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 px-4">
                  <span className="text-slate-400 text-sm font-medium">{t.nav.selectLanguage}</span>
                  <LanguageSwitcher variant="minimal" />
                </div>
                <a
                  href="/login"
                  className="flex items-center justify-center px-4 py-3 rounded-xl font-semibold bg-indigo-500 text-white shadow-lg gap-2"
                >
                  <LogIn size={20} />
                  <span>{t.nav.login}</span>
                </a>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
