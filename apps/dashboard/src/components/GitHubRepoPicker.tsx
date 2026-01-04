'use client';

import { useEffect, useState } from 'react';

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
  selectedRepoUrl,
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
    const token = localStorage.getItem('gh_token');
    if (!token) {
      setError('GitHub token not found. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=100&type=all',
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!res.ok) throw new Error('Failed to fetch repositories');

      const data = await res.json();
      setRepos(data);
    } catch (err) {
      setError('Could not load repositories.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async (repo: Repo) => {
    setLoadingBranches(true);
    const token = localStorage.getItem('gh_token');
    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo.full_name}/branches`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!res.ok) throw new Error('Failed to fetch branches');

      const data = await res.json();
      setBranches(data.map((b: any) => b.name));
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
    r.full_name.toLowerCase().includes(search.toLowerCase())
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
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-white/30 transition-all"
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

          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-white/5 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => handleRepoSelect(repo)}
                  className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/20 rounded-lg">
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
                    <div>
                      <div className="font-medium text-white group-hover:text-blue-400 transition-colors">
                        {repo.full_name}
                      </div>
                      <div className="text-xs text-white/40">
                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <svg
                    className="text-white/20 group-hover:text-white/60 transform group-hover:translate-x-1 transition-all"
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))
            )}

            {!loading && filteredRepos.length === 0 && (
              <div className="text-center py-8 text-white/40">
                No repositories found matching "{search}"
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'config' && selectedRepo && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <svg
                    className="text-blue-400"
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
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedRepo.full_name}
                  </h3>
                  <a
                    href={selectedRepo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    View on GitHub
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              <button
                onClick={resetSelection}
                className="text-sm text-white/40 hover:text-white transition-colors"
              >
                Change Repository
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Branch to Deploy
                </label>
                <div className="relative">
                  <select
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    disabled={loadingBranches}
                    className="w-full appearance-none px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all disabled:opacity-50"
                  >
                    {branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-3.5 pointer-events-none text-white/40">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
