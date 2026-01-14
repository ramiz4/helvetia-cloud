import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminAuth } from '../useAdminAuth';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

// Mock shared-ui
vi.mock('shared-ui', () => ({
  checkAndRefreshToken: vi.fn(),
  Role: {
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
    VIEWER: 'VIEWER',
  },
}));

describe('useAdminAuth', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return loading true initially', () => {
    const { result } = renderHook(() => useAdminAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should handle no user in localStorage', async () => {
    const { result } = renderHook(() => useAdminAuth());

    // Wait for effect to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should return true for admin role', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN' }));

    const { result } = renderHook(() => useAdminAuth());

    // Wait for effect to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(true);
  });

  it('should return false for non-admin role', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MEMBER' }));

    const { result } = renderHook(() => useAdminAuth());

    // Wait for effect to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(result.current.loading).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });
});
