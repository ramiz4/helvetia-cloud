'use client';

import { useEffect, useState } from 'react';
import { getValidatedGitHubToken } from '@/lib/github';

interface Repo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

interface GitHubRepoPickerProps {
  onSelect: (repoUrl: string, branch: string, name: string) => void;
  selectedRepoUrl?: string;
  className?: string;
}

export default function GitHubRepoPicker({
  onSelect,
  selectedRepoUrl: _selectedRepoUrl,
  className = '',
}: GitHubRepoPickerProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [view, setView] = useState<'list' | 'config'>('list');

  useEffect(() => {
    fetchRepos();
  }, []);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);

    // Validate token before making API calls
    const { token, error: validationError } = await getValidatedGitHubToken();

    if (!token) {
      setError(validationError || 'GitHub token not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const allRepos: Repo[] = [];
      let page = 1;
      const perPage = 100;

      // Fetch all pages of repositories until a page returns fewer than perPage items
      // to ensure users with more than perPage repositories see all of them.
      // This relies on GitHub's guarantee of a maximum of `per_page` items per page.
      // See: https://docs.github.com/en/rest/repos/repos#list-repositories-for-the-authenticated-user
      // for pagination details.
      // We intentionally keep requests sequential to avoid hitting rate limits too aggressively.
      // If needed, this could be optimized with concurrency and Link header parsing.
      // For now, sequential fetching is sufficient and simple.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const url = `https://api.github.com/user/repos?sort=updated&per_page=${perPage}&type=all&page=${page}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!res.ok) {
          // Handle token expiration during API call
          if (res.status === 401) {
            localStorage.removeItem('gh_token');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            throw new Error('Token expired or invalid. Please log in again.');
          }
          throw new Error('Failed to fetch repositories');
        }

        const pageData: Repo[] = await res.json();
        allRepos.push(...pageData);

        if (pageData.length < perPage) {
          break;
        }

        page += 1;
      }

      setRepos(allRepos);
    } catch (err) {
      console.error('Failed to load GitHub repositories', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Could not load repositories. Please check your network connection and GitHub token.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (repo: Repo) => {
    setLoadingBranches(true);

    // Validate token before making API calls
    const { token, error: validationError } = await getValidatedGitHubToken();

    if (!token) {
      console.error('Token validation failed:', validationError);
      // Clear tokens and surface an explicit error instead of silently falling back
      try {
        localStorage.removeItem('gh_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (storageError) {
        console.error('Failed to clear auth tokens from localStorage:', storageError);
      }

      setError('Token expired or invalid. Please log in again.');
      setBranches([]);
      setSelectedBranch('');
      setSelectedRepo(null);
      setLoadingBranches(false);
      return;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${repo.full_name}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!res.ok) {
        // Handle token expiration during API call
        if (res.status === 401) {
          localStorage.removeItem('gh_token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          throw new Error('Token expired or invalid. Please log in again.');
        }
        throw new Error('Failed to fetch branches');
      }

      const data = await res.json();
      setBranches(data.map((b: { name: string }) => b.name));
      setSelectedBranch(repo.default_branch);
      // Trigger update immediately with default branch
      onSelect(repo.html_url, repo.default_branch, repo.name);
    } catch (err) {
      console.error(err);
      // Fallback to default branch if api fails
      setBranches([repo.default_branch]);
      setSelectedBranch(repo.default_branch);
      onSelect(repo.html_url, repo.default_branch, repo.name);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleRepoSelect = (repo: Repo) => {
    setSelectedRepo(repo);
    setView('config');
    fetchBranches(repo);
  };

  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    if (selectedRepo) {
      onSelect(selectedRepo.html_url, branch, selectedRepo.name);
    }
  };

  const resetSelection = () => {
    setSelectedRepo(null);
    setBranches([]);
    setView('list');
  };

  // Filter repos
  const filteredRepos = repos.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={`w-full ${className}`}>
      {error && (
        <div className="p-4 mb-4 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
          {error}
        </div>
      )}

      {view === 'list' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="relative mb-6">
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-white/30 transition-all font-sans"
            />
            <svg
              className="absolute right-4 top-3.5 text-white/30"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredRepos.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleRepoSelect(repo)}
                    className="w-full p-4 flex flex-col gap-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all group text-left relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                          {repo.private ? (
                            <svg
                              className="text-yellow-500"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="text-blue-400"
                              width="16"
                              height="16"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                            {repo.full_name}
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            Updated {new Date(repo.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <svg
                        className="text-white/10 group-hover:text-white/60 transform -rotate-45 group-hover:rotate-0 transition-all duration-300"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!loading && filteredRepos.length === 0 && (
              <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
                <p>No repositories found matching "{search}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'config' && selectedRepo && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <svg
                width="120"
                height="120"
                fill="currentColor"
                viewBox="0 0 24 24"
                className="text-white"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/30">
                  <svg
                    className="text-blue-400"
                    width="24"
                    height="24"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {selectedRepo.full_name}
                  </h3>
                  <a
                    href={selectedRepo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 font-medium transition-colors"
                  >
                    View on GitHub
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              </div>
              <button
                onClick={resetSelection}
                className="text-sm text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg bg-black/20"
              >
                Change Repository
              </button>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Branch to Deploy
                </label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    disabled={loadingBranches}
                    className="w-full appearance-none px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all disabled:opacity-50 hover:border-white/20 cursor-pointer"
                  >
                    {branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-3.5 pointer-events-none text-white/40">
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
