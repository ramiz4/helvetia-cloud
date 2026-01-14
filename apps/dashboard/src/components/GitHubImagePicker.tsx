'use client';

import { useLanguage } from 'shared';
import { API_BASE_URL } from 'shared';
import { fetchWithAuth } from 'shared';
import { useCallback, useEffect, useState } from 'react';

interface GitHubPackage {
  id: number;
  name: string;
  package_type: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  version_count: number;
  visibility: string;
  url: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

interface Org {
  login: string;
  avatar_url: string;
}

interface GitHubImagePickerProps {
  onSelect: (imageUrl: string, name: string) => void;
  className?: string;
}

export default function GitHubImagePicker({ onSelect, className = '' }: GitHubImagePickerProps) {
  const { t } = useLanguage();
  const [packages, setPackages] = useState<GitHubPackage[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null); // null means "Personal/All"
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<GitHubPackage | null>(null);
  const [view, setView] = useState<'list' | 'config'>('list');

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/github/orgs`);
      if (res.ok) {
        const data = await res.json();
        setOrgs(data);
      }
    } catch (err) {
      console.error('Failed to fetch organizations', err);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const fetchPackages = useCallback(
    async (orgLogin?: string | null) => {
      setLoading(true);
      setError(null);

      try {
        let url = `${API_BASE_URL}/github/packages`;
        if (orgLogin) {
          url += `?org=${orgLogin}`;
        }

        const res = await fetchWithAuth(url);

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('user');
            throw new Error(t.githubPicker.sessionExpired);
          }
          throw new Error('Failed to fetch packages');
        }

        const data: GitHubPackage[] = await res.json();
        setPackages(data);
      } catch (err) {
        console.error('Failed to load GitHub packages', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch packages';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  useEffect(() => {
    fetchPackages(selectedOrg);
  }, [fetchPackages, selectedOrg]);

  const handlePackageSelect = (pkg: GitHubPackage) => {
    setSelectedPackage(pkg);
    setView('config');
    // Construct simplified image URL (ghcr.io/owner/package)
    // Note: This matches standard GHCR naming convention
    const imageUrl = `ghcr.io/${pkg.owner.login.toLowerCase()}/${pkg.name.toLowerCase()}`;
    onSelect(imageUrl, pkg.name);
  };

  const resetSelection = () => {
    setSelectedPackage(null);
    setView('list');
  };

  // Filter packages
  const filteredPackages = packages.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
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
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search packages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-white/30 transition-all font-sans pl-10"
              />
              <svg
                className="absolute left-3.5 top-3.5 text-white/30"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            <div className="md:w-64 relative">
              <select
                value={selectedOrg || ''}
                onChange={(e) => setSelectedOrg(e.target.value || null)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white appearance-none cursor-pointer transition-all pr-10"
              >
                <option value="" className="bg-gray-900">
                  {loadingOrgs ? t.githubPicker.loadingOrgs : t.githubPicker.allRepos}
                </option>
                {!loadingOrgs && orgs.length === 0 && (
                  <option disabled className="bg-gray-900 text-white/30">
                    {t.githubPicker.noOrgsFound}
                  </option>
                )}
                {orgs.map((org) => (
                  <option key={org.login} value={org.login} className="bg-gray-900">
                    {org.login}
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
                  aria-hidden="true"
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

          <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handlePackageSelect(pkg)}
                    className="w-full p-4 flex flex-col gap-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/30 rounded-xl transition-all group text-left relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                    <div className="flex items-start justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                          <svg
                            className="text-blue-400"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                            {pkg.name}
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            {new Date(pkg.updated_at).toLocaleDateString()}
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
                        aria-hidden="true"
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

            {!loading && filteredPackages.length === 0 && (
              <div className="text-center py-12 text-white/40 bg-white/5 rounded-xl border border-dashed border-white/10">
                <p>No packages found matching &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'config' && selectedPackage && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
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
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    {selectedPackage.name}
                  </h3>
                  <a
                    href={selectedPackage.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 font-medium transition-colors"
                  >
                    View on GitHub
                  </a>
                </div>
              </div>
              <button
                onClick={resetSelection}
                className="text-sm text-white/50 hover:text-white transition-colors border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg bg-black/20"
              >
                Change Package
              </button>
            </div>
            {/* Tag selection could be added here in the future */}
          </div>
        </div>
      )}
    </div>
  );
}
