'use client';

import { Loader2, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GitHubRepoPicker from '../../components/GitHubRepoPicker';
import { GithubIcon } from '../../components/icons/GithubIcon';
import { useLanguage } from '../../lib/LanguageContext';
import { API_BASE_URL } from '../../lib/config';
import { sanitizeServiceName } from '../../utils/serviceName';

type ImportMethod = 'github' | 'manual' | 'database';

export default function NewService() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [importMethod, setImportMethod] = useState<ImportMethod>('github');
  const [formData, setFormData] = useState({
    name: '',
    repoUrl: '',
    branch: 'main',
    buildCommand: 'npm install && npm run build',
    startCommand: 'npm run start',
    port: 3000,
    type: 'DOCKER',
    staticOutputDir: 'dist',
  });
  const [repoSelected, setRepoSelected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      router.push('/login');
    }
  }, [router]);

  const handleRepoSelect = (repoUrl: string, branch: string, repoName: string) => {
    setFormData((prev) => ({
      ...prev,
      repoUrl,
      branch,
      // Auto-suggest service name from repo name if empty
      name: prev.name || sanitizeServiceName(repoName),
    }));
    setRepoSelected(true);
  };

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === 'repoUrl' && value) {
      setRepoSelected(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null); // Clear any previous errors

    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!user) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ...formData, userId: user.id }),
      });

      if (res.ok) {
        const service = await res.json();
        // Trigger initial deploy
        await fetch(`${API_BASE_URL}/services/${service.id}/deploy`, {
          method: 'POST',
          credentials: 'include',
        });
        router.push('/');
      } else {
        const errorData = await res.json();
        // Sanitize error message by converting to string and escaping HTML/special characters
        const errorMsg = errorData.error || 'Unknown error';
        const sanitizedError = String(errorMsg).replace(/[<>&"']/g, '');
        setErrorMessage(`${t.dashboard.newService.errorGeneric}${sanitizedError}`);
      }
    } catch (error) {
      console.error('API connection error:', error);
      setErrorMessage(t.dashboard.newService.errorConnection);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen text-white pt-24 pb-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold bg-linear-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent mb-4 tracking-tight">
            {t.dashboard.newService.title}
          </h1>
          <p className="text-white/60 text-lg">{t.dashboard.newService.subtitle}</p>
        </div>

        {/* Import Method Toggle */}
        <div className="flex gap-4 p-1 bg-white/5 rounded-2xl w-fit mx-auto mb-10 border border-white/5 backdrop-blur-sm">
          <button
            onClick={() => setImportMethod('github')}
            className={`py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 font-medium ${
              importMethod === 'github'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <GithubIcon size={20} />
            {t.dashboard.newService.importGithub}
          </button>
          <button
            onClick={() => {
              setImportMethod('manual');
              setRepoSelected(false);
            }}
            className={`py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 font-medium ${
              importMethod === 'manual'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {t.dashboard.newService.importManual}
          </button>
          <button
            onClick={() => {
              setImportMethod('database');
              setRepoSelected(false);
              setFormData((prev) => ({ ...prev, repoUrl: '' }));
            }}
            className={`py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 font-medium ${
              importMethod === 'database'
                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
            {t.dashboard.newService.importDatabase}
          </button>
        </div>

        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* GitHub Picker Section */}
          {importMethod === 'github' && (
            <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl shadow-2xl">
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/40 text-white">
                    1
                  </span>
                  {t.dashboard.newService.step1}
                </h2>
              </div>
              <div className="p-6">
                <GitHubRepoPicker onSelect={handleRepoSelect} />
              </div>
            </section>
          )}

          {/* Configuration Section */}
          {(importMethod === 'manual' || importMethod === 'database' || repoSelected) && (
            <form
              onSubmit={handleSubmit}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-black/40 text-white">
                    {importMethod === 'github' ? '2' : '1'}
                  </span>
                  {t.dashboard.newService.step2}
                </h2>
              </div>

              <div className="p-8 space-y-8">
                {importMethod === 'manual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8 border-b border-white/5">
                    <div className="md:col-span-2">
                      <label
                        htmlFor="repoUrl"
                        className="block text-sm font-medium text-white/60 mb-2"
                      >
                        {t.dashboard.newService.repoUrl}
                      </label>
                      <input
                        id="repoUrl"
                        type="text"
                        name="repoUrl"
                        placeholder="https://github.com/username/repo"
                        required
                        value={formData.repoUrl}
                        onChange={handleManualInput}
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all hover:border-white/20"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label
                        htmlFor="branch"
                        className="block text-sm font-medium text-white/60 mb-2"
                      >
                        {t.dashboard.newService.branch}
                      </label>
                      <input
                        id="branch"
                        type="text"
                        name="branch"
                        placeholder="main"
                        value={formData.branch}
                        onChange={handleManualInput}
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all hover:border-white/20"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="projectName"
                    className="block text-sm font-medium text-white/60 mb-2"
                  >
                    {t.dashboard.newService.projectName}
                  </label>
                  <input
                    id="projectName"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all hover:border-white/20"
                  />
                  <p className="text-xs text-white/30 mt-2">
                    {t.dashboard.newService.projectNameHint}
                  </p>
                </div>

                {importMethod !== 'database' && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-3">
                      {t.dashboard.newService.serviceType}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'DOCKER', port: 3000 })}
                        className={`p-4 rounded-xl border transition-all text-left flex items-start gap-4 ${
                          formData.type === 'DOCKER'
                            ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/50'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`mt-1 flex items-center justify-center w-8 h-8 rounded-lg ${
                            formData.type === 'DOCKER'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {t.dashboard.newService.dockerService}
                          </div>
                          <p className="text-xs text-white/40 mt-1">
                            {t.dashboard.newService.dockerServiceDesc}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'STATIC', port: 80 })}
                        className={`p-4 rounded-xl border transition-all text-left flex items-start gap-4 ${
                          formData.type === 'STATIC'
                            ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/50'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`mt-1 flex items-center justify-center w-8 h-8 rounded-lg ${
                            formData.type === 'STATIC'
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          <svg
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                            />
                          </svg>
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {t.dashboard.newService.staticSite}
                          </div>
                          <p className="text-xs text-white/40 mt-1">
                            {t.dashboard.newService.staticSiteDesc}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {importMethod === 'database' && (
                  <div>
                    <label className="block text-sm font-medium text-white/60 mb-3">
                      {t.dashboard.newService.databaseEngine}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['POSTGRES', 'REDIS', 'MYSQL'].map((dbType) => (
                        <button
                          key={dbType}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              type: dbType,
                              port: dbType === 'POSTGRES' ? 5444 : dbType === 'REDIS' ? 6379 : 3306,
                            })
                          }
                          className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-3 ${
                            formData.type === dbType
                              ? 'bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/50'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div
                            className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                              formData.type === dbType
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/10 text-white/40'
                            }`}
                          >
                            <svg
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
                                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                              />
                            </svg>
                          </div>
                          <div>
                            <div className="font-semibold text-white capitalize">
                              {dbType === 'POSTGRES'
                                ? 'PostgreSQL'
                                : dbType === 'MYSQL'
                                  ? 'MySQL'
                                  : 'Redis'}
                            </div>
                            <p className="text-xs text-white/40 mt-1">
                              {dbType === 'POSTGRES'
                                ? `${t.dashboard.newService.version} 15`
                                : dbType === 'MYSQL'
                                  ? `${t.dashboard.newService.version} 8`
                                  : `${t.dashboard.newService.version} 7`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {importMethod !== 'database' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="buildCommand"
                        className="block text-sm font-medium text-white/60 mb-2"
                      >
                        {t.dashboard.newService.buildCommand}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20">
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
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <input
                          id="buildCommand"
                          type="text"
                          value={formData.buildCommand}
                          onChange={(e) =>
                            setFormData({ ...formData, buildCommand: e.target.value })
                          }
                          placeholder="npm run build"
                          className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm hover:border-white/20"
                        />
                      </div>
                    </div>

                    {formData.type === 'DOCKER' ? (
                      <div>
                        <label
                          htmlFor="startCommand"
                          className="block text-sm font-medium text-white/60 mb-2"
                        >
                          {t.dashboard.newService.startCommand}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20">
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
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                          </div>
                          <input
                            id="startCommand"
                            type="text"
                            value={formData.startCommand}
                            onChange={(e) =>
                              setFormData({ ...formData, startCommand: e.target.value })
                            }
                            placeholder="npm run start"
                            className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm hover:border-white/20"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="staticOutputDir"
                          className="block text-sm font-medium text-white/60 mb-2"
                        >
                          {t.dashboard.newService.outputDirectory}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20">
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
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                          </div>
                          <input
                            id="staticOutputDir"
                            type="text"
                            value={formData.staticOutputDir}
                            onChange={(e) =>
                              setFormData({ ...formData, staticOutputDir: e.target.value })
                            }
                            placeholder="dist"
                            className="w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm hover:border-white/20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="port" className="block text-sm font-medium text-white/60 mb-2">
                    {t.dashboard.newService.port}
                  </label>
                  <input
                    id="port"
                    type="number"
                    value={formData.port}
                    disabled={['STATIC', 'POSTGRES', 'REDIS', 'MYSQL'].includes(formData.type)}
                    onChange={(e) =>
                      setFormData({ ...formData, port: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white transition-all font-mono text-sm hover:border-white/20 disabled:opacity-50"
                  />
                  {formData.type === 'STATIC' && (
                    <p className="text-xs text-white/30 mt-2">
                      {t.dashboard.newService.portStaticHint}
                    </p>
                  )}
                </div>

                {errorMessage && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
                    <svg
                      width="20"
                      height="20"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      className="text-red-400 mt-0.5 shrink-0"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm text-red-200 font-medium">{errorMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="text-red-300 hover:text-red-100 transition-colors"
                      aria-label="Dismiss error"
                    >
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t.dashboard.newService.deployingButton}
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      {t.dashboard.newService.deployButton}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
