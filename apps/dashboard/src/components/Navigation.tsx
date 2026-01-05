'use client';

import { API_BASE_URL } from '@/lib/config';
import { useLanguage } from '@/lib/LanguageContext';
import { BookOpen, Github, LayoutDashboard, LogIn, LogOut, Plus } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

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
