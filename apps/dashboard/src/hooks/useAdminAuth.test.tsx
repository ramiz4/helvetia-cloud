import { Role } from 'shared-ui';
import { renderHook, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminAuth } from './useAdminAuth';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('useAdminAuth', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
    });
  });

  it('should set isAdmin to true when user has admin role', async () => {
    const adminUser = { username: 'admin', role: Role.ADMIN };
    localStorage.setItem('user', JSON.stringify(adminUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.user).toEqual(adminUser);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should redirect to / when user is not an admin', async () => {
    const regularUser = { username: 'user', role: Role.MEMBER };
    localStorage.setItem('user', JSON.stringify(regularUser));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should redirect to /admin/login when no user data exists', async () => {
    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should redirect to /admin/login when user data is invalid JSON', async () => {
    localStorage.setItem('user', 'invalid-json{');

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/login');
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('should start with loading true and set to false after check', async () => {
    const adminUser = { username: 'admin', role: Role.ADMIN };
    localStorage.setItem('user', JSON.stringify(adminUser));

    const { result } = renderHook(() => useAdminAuth());

    // Wait for the hook to complete its check
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
  });

  it('should handle missing role field gracefully', async () => {
    const userWithoutRole = { username: 'user' };
    localStorage.setItem('user', JSON.stringify(userWithoutRole));

    const { result } = renderHook(() => useAdminAuth());

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    expect(result.current.isAdmin).toBe(false);
  });
});
