import {
  _resetRefreshState,
  API_BASE_URL,
  checkAndRefreshToken,
  fetchWithAuth,
  refreshAccessToken,
} from 'shared-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('tokenRefresh', () => {
  beforeEach(() => {
    _resetRefreshState();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refreshAccessToken', () => {
    it('should return true on successful refresh', async () => {
      (fetch as any).mockResolvedValue({ ok: true });

      const result = await refreshAccessToken();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `${API_BASE_URL}/auth/refresh`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    it('should return false and clear localStorage on failed refresh', async () => {
      (fetch as any).mockResolvedValue({ ok: false });

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should return false and clear localStorage on fetch error', async () => {
      (fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await refreshAccessToken();

      expect(result).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('should reuse existing refresh promise if already refreshing', async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      (fetch as any).mockReturnValue(fetchPromise);

      const firstCall = refreshAccessToken();
      const secondCall = refreshAccessToken();

      // Resolve the fetch promise
      resolvePromise!({ ok: true });

      const [res1, res2] = await Promise.all([firstCall, secondCall]);

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      // Ensure fetch was only called once despite two calls to refreshAccessToken
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchWithAuth', () => {
    it('should return response directly if status is not 401', async () => {
      const mockResponse = { status: 200, ok: true };
      (fetch as any).mockResolvedValue(mockResponse);

      const result = await fetchWithAuth('/api/test');

      expect(result).toBe(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry request on 401 if refresh is successful', async () => {
      const mock401Response = { status: 401 };
      const mockSuccessResponse = { status: 200, ok: true };
      const mockRefreshResponse = { ok: true };

      // Mock user in localStorage so refresh is attempted
      (localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 'test' }));

      (fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) return mockRefreshResponse;
        // First call to the endpoint returns 401, second (retry) returns 200
        if (url === '/api/test') {
          const calls = (fetch as any).mock.calls.filter((c: any) => c[0] === '/api/test');
          return calls.length === 1 ? mock401Response : mockSuccessResponse;
        }
        return mockSuccessResponse;
      });

      const result = await fetchWithAuth('/api/test');

      expect(result).toBe(mockSuccessResponse);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw Error if refresh fails after 401', async () => {
      const mock401Response = { status: 401 };
      const mockRefreshResponse = { ok: false };

      // Mock user in localStorage so refresh is attempted
      (localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 'test' }));

      (fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) return mockRefreshResponse;
        return mock401Response;
      });

      await expect(fetchWithAuth('/api/test')).rejects.toThrow('Unauthorized');
    });
  });

  describe('checkAndRefreshToken', () => {
    it('should return false if no user in localStorage', async () => {
      (localStorage.getItem as any).mockReturnValue(null);

      const result = await checkAndRefreshToken();

      expect(result).toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call refreshAccessToken if user exists', async () => {
      (localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 'test' }));
      (fetch as any).mockResolvedValue({ ok: true });

      const result = await checkAndRefreshToken();

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalled();
    });
  });
});
