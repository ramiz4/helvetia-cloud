'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GitHubRepoPicker from '../../components/GitHubRepoPicker';

export default function NewService() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    repoUrl: '',
    branch: '',
    buildCommand: 'npm install && npm run build',
    startCommand: 'npm run start',
    port: 3000,
  });
  const [repoSelected, setRepoSelected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const ghToken = localStorage.getItem('gh_token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleRepoSelect = (repoUrl: string, branch: string, repoName: string) => {
    setFormData((prev) => ({
      ...prev,
      repoUrl,
      branch,
      // Auto-suggest service name from repo name if empty
      name: prev.name || repoName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
    }));
    setRepoSelected(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!token || !user) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch('http://localhost:3001/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, userId: user.id }),
      });

      if (res.ok) {
        const service = await res.json();
        // Trigger initial deploy
        await fetch(`http://localhost:3001/services/${service.id}/deploy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        router.push('/');
      } else {
        const errorData = await res.json();
        alert(`Failed to create service: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Error connecting to API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
            Deploy a new Project
          </h1>
          <p className="text-white/60">
            Import a Git repository to get started.
          </p>
        </div>

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Repository Selection Section */}
          <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <svg
                  className="text-white"
                  width="24"
                  height="24"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                </svg>
                Import Git Repository
              </h2>
            </div>

            <div className="p-6">
              <GitHubRepoPicker onSelect={handleRepoSelect} />
            </div>
          </section>

          {/* Configuration Section */}
          {repoSelected && (
            <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-white/5">
                <h2 className="text-xl font-semibold">Configure Project</h2>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all"
                  />
                  <p className="text-xs text-white/30 mt-2">
                    Used to identify your project in the dashboard and URL.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      Build Command
                    </label>
                    <input
                      type="text"
                      value={formData.buildCommand}
                      onChange={(e) => setFormData({ ...formData, buildCommand: e.target.value })}
                      placeholder="npm run build"
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-2">
                      Start Command
                    </label>
                    <input
                      type="text"
                      value={formData.startCommand}
                      onChange={(e) => setFormData({ ...formData, startCommand: e.target.value })}
                      placeholder="npm run start"
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">
                    Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Deploying...
                      </>
                    ) : (
                      'Deploy Project'
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
