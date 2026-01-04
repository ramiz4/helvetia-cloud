/**
 * Validates a GitHub token by making a lightweight API call to the /user endpoint.
 * This checks if the token is valid and not expired.
 *
 * @param token - The GitHub access token to validate
 * @returns An object with isValid boolean and optional error message
 */
export async function validateGitHubToken(
  token: string,
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      return { isValid: true };
    }

    // Handle specific error cases
    if (res.status === 401) {
      return {
        isValid: false,
        error: 'Token is invalid or expired. Please log in again.',
      };
    }

    if (res.status === 403) {
      return {
        isValid: false,
        error: 'Token does not have the required permissions.',
      };
    }

    return {
      isValid: false,
      error: 'Failed to validate token. Please try again.',
    };
  } catch (err) {
    console.error('Token validation error:', err);
    return {
      isValid: false,
      error: 'Network error while validating token.',
    };
  }
}

/**
 * Gets the GitHub token from localStorage and validates it.
 * Clears the token if it's invalid.
 *
 * @returns The validated token or null if invalid/missing
 */
export async function getValidatedGitHubToken(): Promise<{
  token: string | null;
  error?: string;
}> {
  const token = localStorage.getItem('gh_token');

  if (!token) {
    return {
      token: null,
      error: 'GitHub token not found. Please log in again.',
    };
  }

  const validation = await validateGitHubToken(token);

  if (!validation.isValid) {
    // Clear invalid token from localStorage
    localStorage.removeItem('gh_token');
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    return {
      token: null,
      error: validation.error,
    };
  }

  return { token };
}
