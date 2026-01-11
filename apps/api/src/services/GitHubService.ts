import axios from 'axios';
import { injectable } from 'tsyringe';
import type {
  GetRepositoriesParams,
  GitHubBranch,
  GitHubOrganization,
  GitHubRepository,
  IGitHubService,
} from '../interfaces';

/**
 * GitHubService
 * Handles interactions with the GitHub API
 */
@injectable()
export class GitHubService implements IGitHubService {
  private readonly baseUrl = 'https://api.github.com';

  /**
   * Get user's GitHub organizations
   */
  async getUserOrganizations(accessToken: string): Promise<GitHubOrganization[]> {
    try {
      const response = await axios.get<GitHubOrganization[]>(`${this.baseUrl}/user/orgs`, {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.handleGitHubError(error, 'Failed to fetch GitHub organizations');
    }
  }

  /**
   * Get user's or organization's repositories
   */
  async getRepositories(
    accessToken: string,
    params: GetRepositoriesParams,
  ): Promise<GitHubRepository[]> {
    // Validation and Sanitization
    const validSorts = ['updated', 'created', 'pushed', 'full_name'];
    const validTypes = ['all', 'owner', 'member', 'public', 'private', 'forks', 'sources'];

    const sanitizedSort = validSorts.includes(params.sort || '')
      ? params.sort!
      : ('updated' as const);
    const sanitizedType = validTypes.includes(params.type || '') ? params.type! : ('all' as const);
    const sanitizedPerPage = Math.max(1, Math.min(100, params.per_page || 100));
    const sanitizedPage = Math.max(1, params.page || 1);

    let url = `${this.baseUrl}/user/repos`;
    const requestParams: Record<string, string | number> = {
      sort: sanitizedSort,
      per_page: sanitizedPerPage,
      page: sanitizedPage,
    };

    if (params.org) {
      // If org is provided, fetch repos for that organization
      url = `${this.baseUrl}/orgs/${params.org}/repos`;
    } else {
      requestParams.type = sanitizedType;
    }

    try {
      const response = await axios.get<GitHubRepository[]>(url, {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: 'application/json',
        },
        params: requestParams,
      });

      return response.data;
    } catch (error) {
      this.handleGitHubError(error, 'Failed to fetch GitHub repositories');
    }
  }

  /**
   * Get branches for a specific repository
   */
  async getRepositoryBranches(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<GitHubBranch[]> {
    // Validation: owner and name should only contain alphanumeric, hyphens, underscores, or dots
    const validPattern = /^[a-zA-Z0-9-._]+$/;
    if (!validPattern.test(owner) || !validPattern.test(repo)) {
      throw new Error('Invalid repository owner or name format');
    }

    try {
      const response = await axios.get<GitHubBranch[]>(
        `${this.baseUrl}/repos/${owner}/${repo}/branches`,
        {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.handleGitHubError(error, 'Failed to fetch branches');
    }
  }

  /**
   * Handle GitHub API errors
   */
  private handleGitHubError(error: unknown, defaultMessage: string): never {
    // Check if error has response property (axios error structure)
    if (axios.isAxiosError(error) && error.response) {
      // GitHub API returned an error response
      throw {
        status: error.response.status,
        data: error.response.data,
        message: defaultMessage,
      };
    }

    // Generic error
    throw {
      status: 500,
      data: { error: defaultMessage },
      message: defaultMessage,
    };
  }
}
