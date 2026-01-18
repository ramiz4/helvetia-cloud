import { Role } from 'database';

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
    email: string | null;
    avatarUrl: string | null;
    githubId: string | null;
    role: Role;
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
  email?: string | null;
}

/**
 * DTO for email/password registration
 */
export interface RegisterDto {
  email: string;
  password: string;
  username: string;
}

/**
 * DTO for email/password login
 */
export interface LoginDto {
  email: string;
  password: string;
}
