'use client';

import { API_BASE_URL } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { type Language } from '@/lib/translations';
import {
  BookOpen,
  ChevronDown,
  Github,
  Globe,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const langMenuRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'gsw', label: 'Schwiizerdütsch', short: 'CH' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' },
  ];

  // Check login status on mount and when interactions occur
  useEffect(() => {
    const checkLogin = () => {
      const user = localStorage.getItem('user');
      setIsLoggedIn(!!user);
    };

    checkLogin();

    // Listen for storage events (e.g. logging out in another tab)
    window.addEventListener('storage', checkLogin);
    return () => window.removeEventListener('storage', checkLogin);
  }, [pathname]); // Also re-check on route change if needed

  // Close the language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      localStorage.removeItem('user');
      // Remove legacy tokens just in case
      localStorage.removeItem('token');
      localStorage.removeItem('gh_token');
      setIsLoggedIn(false);
      router.push('/login');
    }
  };

  const LanguageSwitcher = () => (
    <div className="relative" ref={langMenuRef}>
      <button
        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
        className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Select Language"
        aria-expanded={isLangMenuOpen}
      >
        <Globe size={16} />
        <span className="text-sm font-medium uppercase min-w-[1.2rem]">
          {languages.find((l) => l.code === language)?.short || 'EN'}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isLangMenuOpen && (
        <div className="absolute right-0 mt-2 w-48 py-1 rounded-lg glass border border-white/10 shadow-xl animate-fade-in z-50 overflow-hidden">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLanguage(l.code as Language);
                setIsLangMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-white/10 transition-colors ${
                language === l.code ? 'bg-white/5 text-(--primary)' : 'text-(--text-secondary)'
              }`}
            >
              <span>{l.label}</span>
              <span className="text-xs opacity-50 uppercase">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <nav className="main-nav glass">
      <div className="nav-container">
        <a href="/" className="brand" aria-label="Helvetia Cloud Home">
          <Image
            src="/logo.png"
            alt="Helvetia Cloud Logo"
            width={32}
            height={32}
            className="rounded-lg shadow-[0_0_15px_var(--primary-glow)]"
          />
          <span className="brand-name" aria-hidden="true">
            HELVETIA
          </span>
        </a>

        {isLoggedIn && (
          <>
            <div className="nav-links">
              <a href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                <LayoutDashboard size={18} />
                <span>{t.nav.dashboard}</span>
              </a>
              <a
                href="/deployments"
                className={`nav-item ${pathname === '/deployments' ? 'active' : ''}`}
              >
                <BookOpen size={18} />
                <span>{t.nav.deployments}</span>
              </a>
              {/* hidden until implemented
              <a href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
                <Settings size={18} />
                <span>Settings</span>
              </a>
              */}
            </div>

            <div className="nav-actions">
              <LanguageSwitcher />
              <div className="w-px h-6 bg-white/10 mx-1" />
              <a
                href="https://github.com/ramiz4/helvetia-cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-icon"
                title="GitHub"
              >
                <Github size={20} />
              </a>
              <a href="/new" className="btn btn-primary btn-sm">
                <Plus size={16} />
                <span>{t.nav.newService}</span>
              </a>
              <button onClick={handleLogout} className="btn-icon" title={t.nav.logout}>
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}

        {!isLoggedIn && (
          <div className="nav-actions">
            <LanguageSwitcher />
            <div className="w-px h-6 bg-white/10 mx-1" />
            <a href="/login" className="btn btn-primary btn-sm">
              <LogIn size={16} />
              <span>{t.nav.login}</span>
            </a>
            <a
              href="https://github.com/ramiz4/helvetia-cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-icon"
              title="GitHub"
            >
              <Github size={20} />
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
