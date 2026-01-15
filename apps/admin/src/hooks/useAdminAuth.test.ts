import { renderHook, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { Role } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminAuth } from './useAdminAuth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('useAdminAuth', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  it('should initialize with default values', async () => {
    const { result } = renderHook(() => useAdminAuth());

    // In test environment, useEffect runs synchronously, so loading will already be false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it('should redirect to /login when no user data in localStorage', async () => {
    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should set isAdmin to true for admin users', async () => {
    const adminUser = { username: 'admin', role: Role.ADMIN };
    localStorage.setItem('user', JSON.stringify(adminUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.user).toEqual(adminUser);
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should redirect non-admin users to /', async () => {
    const regularUser = { username: 'user', role: Role.MEMBER };
    localStorage.setItem('user', JSON.stringify(regularUser));

    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('should redirect to /login when user data is invalid JSON', async () => {
    localStorage.setItem('user', 'invalid-json');

    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should redirect to /login when user data is empty string', async () => {
    localStorage.setItem('user', '');

    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should set loading to false after authentication check', async () => {
    const adminUser = { username: 'admin', role: Role.ADMIN };
    localStorage.setItem('user', JSON.stringify(adminUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle missing role property in user data', async () => {
    const userWithoutRole = { username: 'user' };
    localStorage.setItem('user', JSON.stringify(userWithoutRole));

    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('should not set user state for non-admin users', async () => {
    const regularUser = { username: 'user', role: Role.MEMBER };
    localStorage.setItem('user', JSON.stringify(regularUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  it('should handle user data with additional properties', async () => {
    const adminUser = {
      username: 'admin',
      role: Role.ADMIN,
      email: 'admin@example.com',
      id: '123',
    };
    localStorage.setItem('user', JSON.stringify(adminUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.isAdmin).toBe(true);
      expect(result.current.user).toEqual(adminUser);
    });
  });

  it('should only call router.push once for unauthenticated users', async () => {
    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });

  it('should only call router.push once for non-admin users', async () => {
    const regularUser = { username: 'user', role: Role.MEMBER };
    localStorage.setItem('user', JSON.stringify(regularUser));

    renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('should complete loading state even when redirecting', async () => {
    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });
  });
});
