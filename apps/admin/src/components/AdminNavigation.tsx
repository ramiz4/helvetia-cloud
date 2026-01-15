'use client';

import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Flag, LayoutDashboard, Server } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Navigation, NavLink, useLanguage } from 'shared-ui';

export default function AdminNavigation() {
  const { user, isAdmin, loading, logout } = useAdminAuth();
  const pathname = usePathname();
  const { t } = useLanguage();

  if (loading || !isAdmin || !user) {
    return null;
  }

  const adminLinks: NavLink[] = [
    {
      label: 'Admin Panel', // Fallback if no translation
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'Server Setup',
      href: '/server-setup',
      icon: Server,
    },
    {
      label: 'Feature Flags',
      href: '/feature-flags',
      icon: Flag,
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Navigation
      user={{
        id: 'admin', // Placeholder id
        username: user.username,
      }}
      isLoggedIn={true}
      onLogout={handleLogout}
      links={adminLinks}
      planLabel="Administrator"
    />
  );
}
