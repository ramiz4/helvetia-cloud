/**
 * GitHub API organization response
 */
export interface GitHubOrganization {
  login: string;
  id: number;
  node_id: string;
  url: string;
  repos_url: string;
  events_url: string;
  hooks_url: string;
  issues_url: string;
  members_url: string;
  public_members_url: string;
  avatar_url: string;
  description: string | null;
}

/**
 * GitHub API repository response
 */
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
}

/**
 * GitHub API branch response
 */
export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

/**
 * Query parameters for fetching repositories
 */
export interface GetRepositoriesParams {
  sort?: 'updated' | 'created' | 'pushed' | 'full_name';
  type?: 'all' | 'owner' | 'member' | 'public' | 'private' | 'forks' | 'sources';
  per_page?: number;
  page?: number;
  org?: string;
}

/**
 * Interface for GitHub API service operations
 */
export interface IGitHubService {
  /**
   * Get user's GitHub organizations
   */
  getUserOrganizations(accessToken: string): Promise<GitHubOrganization[]>;

  /**
   * Get user's or organization's repositories
   */
  getRepositories(accessToken: string, params: GetRepositoriesParams): Promise<GitHubRepository[]>;

  /**
   * Get branches for a specific repository
   */
  getRepositoryBranches(accessToken: string, owner: string, repo: string): Promise<GitHubBranch[]>;
}
