'use client';

import GitHubRepoPicker from '@/components/GitHubRepoPicker';
import { useLanguage } from '@/lib/LanguageContext';
import { API_BASE_URL } from '@/lib/config';
import { fetchWithAuth } from '@/lib/tokenRefresh';
import {
  ArrowLeft,
  ChevronRight,
  Code,
  Combine,
  Database,
  FileCode,
  FolderOpen,
  Github,
  Globe,
  Loader2,
  Plus,
  Rocket,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

type ImportType = 'github' | 'manual' | 'local' | 'compose' | 'database';

export default function NewServicePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [importType, setImportType] = useState<ImportType>('github');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [projectName, setProjectName] = useState('');
  const [serviceType, setServiceType] = useState<'docker' | 'static'>('docker');
  const [buildCommand, setBuildCommand] = useState('');
  const [startCommand, setStartCommand] = useState('');
  const [outputDirectory, setOutputDirectory] = useState('dist');
  const [port, setPort] = useState(3000);
  const [composeFile, setComposeFile] = useState('docker-compose.yml');
  const [mainService, setMainService] = useState('app');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [dbEngine, setDbEngine] = useState<'postgres' | 'redis' | 'mysql'>('postgres');

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let finalType = importType === 'compose' ? 'COMPOSE' : serviceType.toUpperCase();
    if (importType === 'database') {
      finalType = dbEngine.toUpperCase();
    }

    const data = {
      name: projectName,
      repoUrl,
      branch,
      type: finalType,
      buildCommand,
      startCommand: serviceType === 'docker' ? startCommand : undefined,
      staticOutputDir: serviceType === 'static' ? outputDirectory : undefined,
      port: serviceType === 'docker' || importType === 'compose' ? port : undefined,
      composeFile: importType === 'compose' ? composeFile : undefined,
      mainService: importType === 'compose' ? mainService : undefined,
      envVars: Object.fromEntries(envVars.map((ev) => [ev.key, ev.value])),
    };

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.message || t.dashboard.newService.errorGeneric + 'Status ' + res.status,
        );
      }

      const createdService = await res.json();

      // Automatically Start Deployment
      const deployRes = await fetchWithAuth(
        `${API_BASE_URL}/services/${createdService.id}/deploy`,
        {
          method: 'POST',
        },
      );

      if (deployRes.ok) {
        toast.success(t.dashboard.newService.deploySuccess);
      } else {
        toast.success(t.common.success);
        toast.error(t.dashboard.actions.deployTriggerFailed);
      }

      router.push('/');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : t.dashboard.newService.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index][field] = value;
    setEnvVars(newVars);
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="mb-12">
        <Link
          href="/"
          className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors group text-sm font-medium"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
          {t.common.back}
        </Link>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
          {t.dashboard.newService.title}
        </h1>
        <p className="text-slate-400 text-lg">{t.dashboard.newService.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Step Indicator */}
        <div className="lg:col-span-3">
          <div className="space-y-4 relative">
            {/* Connector Line */}
            <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-white/5" />

            <div
              className={`flex items-center gap-4 relative z-10 p-2 rounded-2xl transition-all ${
                step === 1 ? 'bg-indigo-500/10' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  step >= 1 ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-slate-500'
                }`}
              >
                1
              </div>
              <div className={step === 1 ? 'text-white' : 'text-slate-500'}>
                {t.dashboard.newService.step1}
              </div>
            </div>

            <div
              className={`flex items-center gap-4 relative z-10 p-2 rounded-2xl transition-all ${
                step === 2 ? 'bg-indigo-500/10' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                  step >= 2 ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/5 text-slate-500'
                }`}
              >
                2
              </div>
              <div className={step === 2 ? 'text-white' : 'text-slate-500'}>
                {t.dashboard.newService.step2}
              </div>
            </div>
          </div>

          <div className="mt-12 p-6 bg-slate-900/50 rounded-2xl border border-white/10 hidden lg:block">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              {t.dashboard.newService.importGithub}
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Rocket size={14} />
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Fast deployments with zero-downtime rollouts.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                  <Globe size={14} />
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  {t.footer.hostedInSwiss}.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Area */}
        <div className="lg:col-span-9">
          {step === 1 ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { id: 'github', label: t.dashboard.newService.importGithub, icon: Github },
                  { id: 'compose', label: t.dashboard.newService.importCompose, icon: Combine },
                  { id: 'local', label: t.dashboard.newService.importLocal, icon: FolderOpen },
                  { id: 'database', label: t.dashboard.newService.importDatabase, icon: Database },
                  { id: 'manual', label: t.dashboard.newService.importManual, icon: FileCode },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setImportType(type.id as ImportType)}
                    className={`p-6 rounded-2xl flex flex-col items-center justify-center gap-3 border transition-all active:scale-95 ${
                      importType === type.id
                        ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                        : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <type.icon size={24} />
                    <span className="text-xs font-bold tracking-tight">{type.label}</span>
                  </button>
                ))}
              </div>

              <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 min-h-[400px]">
                {importType === 'github' && (
                  <GitHubRepoPicker
                    onSelect={(url, b, n) => {
                      setRepoUrl(url);
                      setBranch(b);
                      setProjectName(n);
                      setStep(2);
                    }}
                  />
                )}

                {importType === 'local' && (
                  <div className="space-y-6 max-w-xl mx-auto py-12">
                    <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <FolderOpen size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-white">
                        {t.dashboard.newService.importLocal}
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">Deploy from your computer.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          {t.dashboard.newService.localPath}
                        </label>
                        <input
                          type="text"
                          placeholder="/Users/name/projects/my-app"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                        />
                        <p className="mt-2 text-[10px] text-slate-500 italic">
                          {t.dashboard.newService.localPathHint}
                        </p>
                      </div>

                      <button
                        onClick={() => setStep(2)}
                        disabled={!repoUrl}
                        className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {t.common.next}
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}

                {['manual', 'database', 'compose'].includes(importType) &&
                  importType !== 'github' && (
                    <div className="space-y-6 max-w-xl mx-auto py-12">
                      <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                          {importType === 'compose' ? (
                            <Combine size={32} />
                          ) : importType === 'database' ? (
                            <Database size={32} />
                          ) : (
                            <FileCode size={32} />
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                          {importType === 'compose'
                            ? t.dashboard.newService.importCompose
                            : importType === 'database'
                              ? t.dashboard.newService.importDatabase
                              : t.dashboard.newService.importManual}
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">Manual configuration.</p>
                      </div>

                      <div className="space-y-4">
                        {importType !== 'database' && (
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              {t.dashboard.newService.repoUrl}
                            </label>
                            <input
                              type="text"
                              placeholder="https://github.com/..."
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                            />
                          </div>
                        )}

                        {importType === 'database' && (
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              {t.dashboard.newService.databaseEngine}
                            </label>
                            <select
                              value={dbEngine}
                              onChange={(e) =>
                                setDbEngine(e.target.value as 'postgres' | 'redis' | 'mysql')
                              }
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white cursor-pointer appearance-none transition-all"
                            >
                              <option value="postgres">PostgreSQL</option>
                              <option value="mysql">MySQL</option>
                              <option value="redis">Redis</option>
                            </select>
                          </div>
                        )}

                        <button
                          onClick={() => setStep(2)}
                          disabled={importType !== 'database' && !repoUrl}
                          className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {t.common.next}
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <form onSubmit={handleCreateService} className="space-y-8">
                <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
                  <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                    <Settings className="text-indigo-400" size={24} />
                    {t.dashboard.newService.step2}
                  </h2>

                  {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 text-xs font-bold mt-0.5 animate-pulse">
                        !
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-red-400">{t.common.error}</div>
                        <div className="text-xs text-red-400/80 leading-relaxed mt-1">{error}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="text-red-400/40 hover:text-red-400 transition-colors"
                        aria-label={t.dashboard.newService.dismissError}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                          {t.dashboard.newService.projectName}
                        </label>
                        <input
                          type="text"
                          required
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-semibold"
                          placeholder="my-awesome-service"
                        />
                        <p className="mt-2 text-[10px] text-slate-500">
                          {t.dashboard.newService.projectNameHint}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-2">
                            {t.dashboard.newService.serviceType}
                          </label>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => setServiceType('docker')}
                              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                                serviceType === 'docker'
                                  ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                                  : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                              }`}
                            >
                              <Combine size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {t.dashboard.newService.dockerService}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setServiceType('static')}
                              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                                serviceType === 'static'
                                  ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                                  : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                              }`}
                            >
                              <Globe size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {t.dashboard.newService.staticSite}
                              </span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-400 mb-2">
                            {t.dashboard.newService.branch}
                          </label>
                          <input
                            type="text"
                            required
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                            placeholder="main"
                          />
                        </div>
                      </div>

                      {importType === 'compose' ? (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              {t.dashboard.newService.composeFile}
                            </label>
                            <input
                              type="text"
                              value={composeFile}
                              onChange={(e) => setComposeFile(e.target.value)}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                              placeholder="docker-compose.yml"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              {t.dashboard.newService.mainServiceName}
                            </label>
                            <input
                              type="text"
                              value={mainService}
                              onChange={(e) => setMainService(e.target.value)}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                              placeholder="app"
                            />
                            <p className="mt-2 text-[10px] text-slate-500">
                              {t.dashboard.newService.mainServiceDesc}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-2">
                                {t.dashboard.newService.buildCommand}
                              </label>
                              <input
                                type="text"
                                value={buildCommand}
                                onChange={(e) => setBuildCommand(e.target.value)}
                                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                                placeholder="npm run build"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-400 mb-2">
                                {serviceType === 'docker'
                                  ? t.dashboard.newService.startCommand
                                  : t.dashboard.newService.outputDirectory}
                              </label>
                              <input
                                type="text"
                                value={serviceType === 'docker' ? startCommand : outputDirectory}
                                onChange={(e) =>
                                  serviceType === 'docker'
                                    ? setStartCommand(e.target.value)
                                    : setOutputDirectory(e.target.value)
                                }
                                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                                placeholder={serviceType === 'docker' ? 'npm start' : 'dist'}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                              {t.dashboard.newService.port}
                            </label>
                            <input
                              type="number"
                              disabled={serviceType === 'static'}
                              value={port}
                              onChange={(e) => setPort(parseInt(e.target.value))}
                              className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm disabled:opacity-50"
                              placeholder="3000"
                            />
                            {serviceType === 'static' && (
                              <p className="mt-2 text-[10px] text-slate-500 italic">
                                {t.dashboard.newService.portStaticHint}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-slate-400">
                            {t.dashboard.labels.envVars}
                          </label>
                          <button
                            type="button"
                            onClick={addEnvVar}
                            className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 transition-all"
                          >
                            <Plus size={12} /> {t.dashboard.newService.addVariable}
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                          {envVars.length === 0 ? (
                            <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600">
                              <Code size={32} className="mb-3 opacity-20" />
                              <span className="text-xs">{t.dashboard.newService.noEnvVars}</span>
                            </div>
                          ) : (
                            envVars.map((ev, i) => (
                              <div
                                key={i}
                                className="flex gap-2 animate-in fade-in zoom-in-95 duration-200"
                              >
                                <input
                                  type="text"
                                  placeholder="KEY"
                                  value={ev.key}
                                  onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                                  className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono text-xs uppercase"
                                />
                                <input
                                  type="text"
                                  placeholder="VALUE"
                                  value={ev.value}
                                  onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                                  className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEnvVar(i)}
                                  className="p-2.5 bg-white/5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-slate-900/50 border border-white/10 rounded-3xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400">
                      <Combine size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Helvetia Pro Cluster</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        Tier 1 • {t.footer.hostedInSwiss}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 md:flex-none px-8 py-4 rounded-2xl font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5"
                    >
                      {t.common.back}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-2 md:flex-none px-12 py-4 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 min-w-[200px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={20} />
                          {t.dashboard.newService.deployingButton}
                        </>
                      ) : (
                        <>
                          <Rocket size={20} />
                          {t.dashboard.newService.deployButton}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
