'use client';

import { LogOut, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLanguage } from '../config/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import UserMenu from './UserMenu';

export interface NavLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  show?: boolean;
}

interface NavigationProps {
  user: {
    id: string;
    username: string;
    avatarUrl?: string;
  } | null;
  isLoggedIn: boolean;
  onLogout: () => Promise<void>;
  links: NavLink[];
  logoUrl?: string;
  rightActions?: React.ReactNode;
  userMenuChildren?: React.ReactNode;
  mobileMenuExtra?: React.ReactNode;
  planLabel?: string;
  themeSwitcher?: React.ReactNode;
  desktopThemeSwitcher?: React.ReactNode;
}

export default function Navigation({
  user,
  isLoggedIn,
  onLogout,
  links,
  logoUrl = '/logo.png',
  rightActions,
  userMenuChildren,
  mobileMenuExtra,
  planLabel,
  themeSwitcher,
  desktopThemeSwitcher,
}: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

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
        `,
          }}
        />

        {/* Liquid Glass Background Layer */}
        <div
          className="absolute inset-0 -z-10 border-b border-white/10 shadow-2xl overflow-hidden hidden dark:block"
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
        <div className="absolute inset-0 -z-10 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:hidden" />

        <div className="max-w-[1280px] mx-auto px-6 h-[70px] flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 font-bold text-xl text-slate-900 dark:text-white font-display tracking-tight z-50 shrink-0"
            aria-label={t.nav.homeAria}
          >
            <Image
              src={logoUrl}
              alt={t.nav.logoAlt}
              width={32}
              height={32}
              className="rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            />
            <span className="flex items-center gap-2" aria-hidden="true">
              {t.nav.brand}
            </span>
          </Link>

          {isLoggedIn && rightActions && <div className="hidden lg:block ml-4">{rightActions}</div>}

          {/* Desktop Navigation */}
          {isLoggedIn ? (
            <div className="hidden lg:flex items-center gap-6">
              <div className="flex gap-2">
                {links
                  .filter((link) => link.show !== false)
                  .map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium transition-all ${
                          isActive
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={18} />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
              </div>

              <div className="flex items-center gap-4">
                {desktopThemeSwitcher || themeSwitcher}
                <LanguageSwitcher />
                <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
                {user && (
                  <UserMenu user={user} onLogout={onLogout} planLabel={planLabel}>
                    {userMenuChildren}
                  </UserMenu>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-4">
              {desktopThemeSwitcher || themeSwitcher}
              <LanguageSwitcher />
              <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-medium cursor-pointer transition-all border border-transparent text-[14px] gap-2 bg-indigo-500 text-white shadow-lg hover:bg-indigo-600 hover:-translate-y-0.5 active:scale-95"
              >
                <span>{t.nav.login}</span>
              </Link>
            </div>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex lg:hidden items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white z-50 transition-colors"
            aria-label={isMenuOpen ? t.nav.closeMenu : t.nav.openMenu}
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
            className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            id="mobile-menu"
            className="absolute top-[70px] left-0 right-0 max-h-[calc(100vh-70px)] bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-white/10 overflow-y-auto animate-in slide-in-from-top-4 duration-300 p-6 flex flex-col gap-6"
            role="navigation"
            aria-label={t.nav.mobileMenu}
            style={{
              backdropFilter: 'blur(20px) saturate(200%)',
              WebkitBackdropFilter: 'blur(20px) saturate(200%)',
            }}
          >
            {isLoggedIn ? (
              <>
                <div className="flex flex-col gap-2">
                  {links
                    .filter((link) => link.show !== false)
                    .map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[16px] font-medium transition-all ${
                            isActive
                              ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Icon size={20} />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  {mobileMenuExtra}
                </div>

                <div className="h-px bg-slate-200 dark:bg-white/10" />

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 px-4">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      {t.nav.selectLanguage}
                    </span>
                    <LanguageSwitcher variant="minimal" />
                  </div>

                  {themeSwitcher && (
                    <div className="flex flex-col gap-3 px-4">
                      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {t.theme?.switchTheme || 'Theme'}
                      </span>
                      {themeSwitcher}
                    </div>
                  )}

                  {user && (
                    <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-indigo-50 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.username}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                            <span className="text-lg font-bold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {user.username}
                        </span>
                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                          {planLabel || t.common.freePlan}
                        </span>
                      </div>
                      <button
                        onClick={onLogout}
                        className="ml-auto p-2 text-rose-500 dark:text-red-400 hover:bg-rose-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
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
                  <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                    {t.nav.selectLanguage}
                  </span>
                  <LanguageSwitcher variant="minimal" />
                </div>
                {themeSwitcher && (
                  <div className="flex flex-col gap-3 px-4">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                      {t.theme?.switchTheme || 'Theme'}
                    </span>
                    {themeSwitcher}
                  </div>
                )}
                <Link
                  href="/login"
                  className="flex items-center justify-center px-4 py-3 rounded-xl font-semibold bg-indigo-500 text-white shadow-lg gap-2"
                >
                  <span>{t.nav.login}</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
