import { API_BASE_URL } from './config';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Refresh the access token using the refresh token stored in httpOnly cookie
 */
export async function refreshAccessToken(): Promise<boolean> {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send cookies including refresh token
      });

      if (response.ok) {
        console.log('Access token refreshed successfully');
        return true;
      }

      // If refresh fails, clear user data and redirect to login
      console.log('Token refresh failed, logging out');
      localStorage.removeItem('user');
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      localStorage.removeItem('user');
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Reset the internal state for testing purposes
 */
export function _resetRefreshState() {
  isRefreshing = false;
  refreshPromise = null;
}

/**
 * Enhanced fetch that automatically handles 401 errors by refreshing the token
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // Ensure credentials are included to send cookies
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };

  // Make the initial request
  let response = await fetch(url, fetchOptions);

  // If we get a 401, try to refresh the token and retry once
  if (response.status === 401) {
    console.log('Received 401, attempting to refresh token');

    const refreshed = await refreshAccessToken();

    if (refreshed) {
      // Retry the original request with the new token
      console.log('Retrying request after token refresh');
      response = await fetch(url, fetchOptions);
    } else {
      // If refresh failed, throw to handle logout in the calling code
      throw new Error('Unauthorized');
    }
  }

  return response;
}

/**
 * Check if token needs refresh (called on app load)
 * This proactively refreshes the token if we're authenticated
 */
export async function checkAndRefreshToken(): Promise<boolean> {
  const user = localStorage.getItem('user');

  if (!user) {
    return false;
  }

  // Try to refresh the token proactively
  return refreshAccessToken();
}
