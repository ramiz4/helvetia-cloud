'use client';

import ModernThemeSwitch from '@/components/ModernThemeSwitch';
import { useFeatureFlag } from '@/lib/featureFlags';
import { useOrganizationContext } from '@/lib/OrganizationContext';
import { BookOpen, Building2, CreditCard, LayoutDashboard, Settings, Tag } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_BASE_URL, Navigation, NavLink, Role, useLanguage } from 'shared-ui';
import OrganizationSwitcher from './OrganizationSwitcher';

export default function DashboardNavigation() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    username: string;
    avatarUrl?: string;
    role?: Role;
  } | null>(null);

  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { currentOrganization } = useOrganizationContext();
  const { enabled: showDeployments } = useFeatureFlag('show-deployments', user?.id, {
    enabled: isLoggedIn,
  });

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
    window.addEventListener('auth-change', checkLogin);

    return () => {
      window.removeEventListener('storage', checkLogin);
      window.removeEventListener('auth-change', checkLogin);
    };
  }, [pathname]);

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
      window.dispatchEvent(new Event('auth-change'));
      setIsLoggedIn(false);
      setUser(null);
      router.push('/login');
    }
  };

  const dashboardLinks: NavLink[] = [
    {
      label: t.nav.dashboard,
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: t.nav.deployments,
      href: '/deployments',
      icon: BookOpen,
      show: showDeployments,
    },
    {
      label: 'Pricing',
      href: '/pricing',
      icon: Tag,
      isPublic: true,
      show: !isLoggedIn,
    },
    {
      label: t.nav.billing,
      href: '/billing',
      icon: CreditCard,
    },
  ];

  const userMenuChildren = (
    <>
      <Link
        href="/settings"
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 text-[13px] font-medium transition-all group/item"
        role="menuitem"
      >
        <Settings
          size={16}
          className="text-slate-400 dark:text-slate-400 group-hover/item:text-indigo-500 dark:group-hover/item:text-indigo-400 transition-colors"
        />
        <span>{t.nav.settings}</span>
      </Link>

      {currentOrganization && (
        <Link
          href={`/organizations/${currentOrganization.id}/settings`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 text-[13px] font-medium transition-all group/item"
          role="menuitem"
        >
          <Building2
            size={16}
            className="text-slate-400 dark:text-slate-400 group-hover/item:text-indigo-500 dark:group-hover/item:text-indigo-400 transition-colors"
          />
          <span>Organization Settings</span>
        </Link>
      )}
    </>
  );

  const mobileMenuExtra = (
    <Link
      href="/settings"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[16px] font-medium transition-all ${
        pathname === '/settings'
          ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Settings size={20} />
      <span>{t.nav.settings}</span>
    </Link>
  );

  return (
    <Navigation
      user={user}
      isLoggedIn={isLoggedIn}
      onLogout={handleLogout}
      links={dashboardLinks}
      rightActions={<OrganizationSwitcher />}
      userMenuChildren={userMenuChildren}
      mobileMenuExtra={mobileMenuExtra}
      desktopThemeSwitcher={<ModernThemeSwitch />}
      themeSwitcher={<ModernThemeSwitch variant="minimal" />}
    />
  );
}
