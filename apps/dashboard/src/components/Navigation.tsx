'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Plus,
  Settings,
  BookOpen,
  LogOut,
  Github
} from 'lucide-react';

export default function Navigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Check login status on mount and when interactions occur
  useEffect(() => {
    const checkLogin = () => {
      const token = localStorage.getItem('token');
      setIsLoggedIn(!!token);
    };

    checkLogin();

    // Listen for storage events (e.g. logging out in another tab)
    window.addEventListener('storage', checkLogin);
    return () => window.removeEventListener('storage', checkLogin);
  }, [pathname]); // Also re-check on route change if needed

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="main-nav glass">
      <div className="nav-container">
        <a href="/" className="brand">
          <div className="logo-icon">
            <div className="logo-inner"></div>
          </div>
          <span className="brand-name">HELVETIA</span>
        </a>

        {isLoggedIn && (
          <>
            <div className="nav-links">
              <a href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </a>
              <a href="/deployments" className={`nav-item ${pathname === '/deployments' ? 'active' : ''}`}>
                <BookOpen size={18} />
                <span>Deployments</span>
              </a>
              {/* hidden until implemented
              <a href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
                <Settings size={18} />
                <span>Settings</span>
              </a>
              */}
            </div>

            <div className="nav-actions">
              <a href="https://github.com/ramiz4/helvetia-cloud" target="_blank" rel="noopener noreferrer" className="btn-icon" title="GitHub">
                <Github size={20} />
              </a>
              <a href="/new" className="btn btn-primary btn-sm">
                <Plus size={16} />
                <span>New Service</span>
              </a>
              <button onClick={handleLogout} className="btn-icon" title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          </>
        )}

        {!isLoggedIn && (
          <div className="nav-actions">
            <a href="https://github.com/ramiz4/helvetia-cloud" target="_blank" rel="noopener noreferrer" className="btn-icon" title="GitHub">
              <Github size={20} />
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
