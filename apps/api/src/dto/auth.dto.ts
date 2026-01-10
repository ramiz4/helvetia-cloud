/**
 * Data Transfer Objects for Authentication operations
 */

/**
 * DTO for GitHub OAuth authentication
 */
export interface GitHubAuthDto {
  code: string;
}

/**
 * DTO for authentication response
 */
export interface AuthResponseDto {
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
    githubId: string;
  };
  token: string;
}

/**
 * DTO for refresh token request
 */
export interface RefreshTokenDto {
  refreshToken: string;
}

/**
 * DTO for GitHub user data
 */
export interface GitHubUserDto {
  id: number;
  login: string;
  avatar_url: string;
}
