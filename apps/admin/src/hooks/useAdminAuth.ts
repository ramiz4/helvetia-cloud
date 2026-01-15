'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { API_BASE_URL, Role } from 'shared-ui';

interface User {
  username: string;
  role: Role;
}

interface UseAdminAuthReturn {
  isAdmin: boolean;
  loading: boolean;
  user: User | null;
  logout: () => Promise<void>;
}

/**
 * Custom hook to check if the current user has admin role and handle redirects.
 * Redirects to /login if not authenticated, or to / if not an admin.
 *
 * @returns {UseAdminAuthReturn} Object containing isAdmin flag, loading state, user data and logout function
 */
export function useAdminAuth(): UseAdminAuthReturn {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout API call failed:', err);
    } finally {
      localStorage.removeItem('user');
      router.push('/login');
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');

    if (userStr) {
      try {
        const userData = JSON.parse(userStr);

        if (userData.role === Role.ADMIN) {
          setIsAdmin(true);
          setUser(userData);
        } else {
          // User is authenticated but not an admin
          router.push('/');
        }
      } catch {
        // Invalid user data in localStorage
        router.push('/login');
      }
    } else {
      // No user data found
      router.push('/login');
    }

    setLoading(false);
  }, [router]);

  return { isAdmin, loading, user, logout };
}
