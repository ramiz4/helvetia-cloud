import { Code, Combine, Globe, Loader2, Plus, Rocket, Settings, Trash2, X } from 'lucide-react';
import { useLanguage } from 'shared-ui';
import {
  ComposeConfigFields,
  DockerConfigFields,
  GHCRConfigFields,
  StaticConfigFields,
} from '../service-forms';
import { ServiceFormData } from './types';

interface ConfigurationStepProps {
  data: ServiceFormData;
  updateData: (data: Partial<ServiceFormData>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
}

export default function ConfigurationStep({
  data,
  updateData,
  onSubmit,
  onBack,
  loading,
  error,
  setError,
}: ConfigurationStepProps) {
  const { t } = useLanguage();
  const {
    projectName,
    importType,
    repoUrl,
    branch,
    serviceType,
    buildCommand,
    startCommand,
    staticOutputDir,
    port,
    composeFile,
    mainService,
    envVars,
    volumes,
  } = data;

  const addVolume = () => updateData({ volumes: [...volumes, ''] });
  const removeVolume = (index: number) =>
    updateData({ volumes: volumes.filter((_, i) => i !== index) });
  const updateVolume = (index: number, value: string) => {
    const newVolumes = [...volumes];
    newVolumes[index] = value;
    updateData({ volumes: newVolumes });
  };

  const addEnvVar = () => updateData({ envVars: [...envVars, { key: '', value: '' }] });
  const removeEnvVar = (index: number) =>
    updateData({ envVars: envVars.filter((_, i) => i !== index) });
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index][field] = value;
    updateData({ envVars: newVars });
  };

  const isDatabase = importType === 'database';
  const isGithubImage = importType === 'github-image';

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-3 text-indigo-400">
            <Settings size={28} />
            {t.dashboard.newService.step3}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 p-6 bg-black/40 rounded-[24px] border border-white/5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Project
              </label>
              <div className="text-white font-bold truncate">{data.projectId || 'None'}</div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Environment
              </label>
              <div className="text-indigo-400 font-bold truncate capitalize">
                {data.environmentId || 'None'}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Service Name
              </label>
              <div className="text-white font-bold truncate">{data.projectName}</div>
            </div>
          </div>

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
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(e) => updateData({ projectName: e.target.value })}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-semibold"
                  placeholder="my-awesome-service"
                />
                <p className="text-[10px] text-slate-500 font-medium tracking-tight mt-2">
                  {t.dashboard.newService.projectNameHint}
                  {projectName && !/^[a-z0-9-]+$/.test(projectName) && (
                    <span className="text-rose-400 ml-2">
                      ({t.dashboard.newService.projectNameValidation})
                    </span>
                  )}
                </p>
              </div>

              {/* Dynamic Config Fields */}
              <div className="grid grid-cols-2 gap-4">
                {isGithubImage ? (
                  <>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Image URL
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={repoUrl}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-slate-400 font-mono text-xs cursor-not-allowed"
                      />
                    </div>
                  </>
                ) : !isDatabase ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        {t.dashboard.newService.serviceType}
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => updateData({ serviceType: 'docker' })}
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
                          onClick={() => updateData({ serviceType: 'static' })}
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
                        <button
                          type="button"
                          onClick={() => updateData({ serviceType: 'compose' })}
                          className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                            serviceType === 'compose'
                              ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                              : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                          }`}
                        >
                          <Combine size={18} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {t.dashboard.newService.importCompose}
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
                        onChange={(e) => updateData({ branch: e.target.value })}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white transition-all font-mono text-sm"
                        placeholder="main"
                      />
                    </div>
                  </>
                ) : null}
              </div>

              {/* Specialized Form Fields */}
              <div className="pt-2">
                {isGithubImage ? (
                  <GHCRConfigFields
                    data={{
                      branch: branch,
                      startCommand: startCommand,
                      port: port,
                    }}
                    onChange={(updates: Partial<ServiceFormData>) => updateData(updates)}
                    translations={t.dashboard}
                    disabled={loading}
                  />
                ) : serviceType === 'compose' ? (
                  <ComposeConfigFields
                    data={{
                      buildCommand: composeFile,
                      startCommand: mainService,
                      port: port,
                    }}
                    onChange={(updates: Partial<ServiceFormData>) => {
                      const mapping: Partial<ServiceFormData> = {};
                      if (updates.composeFile !== undefined)
                        mapping.composeFile = updates.composeFile;
                      // The ComposeConfigFields might return 'buildCommand' as composeFile if strictly using BaseConfigFieldsProps keys?
                      // Wait, ComposeConfigFields internally likely uses 'buildCommand' for file field.
                      // Let's check logic: original code mapped buildCommand -> composeFile.
                      // So updates probably comes with 'buildCommand'.
                      // But I typed updates as Partial<ServiceFormData> which has composeFile.
                      // If ComposeConfigFields calls onChange({ buildCommand: ... }), then typing it as Partial<ServiceFormData> is awkward if it doesn't match.
                      // However, looking at the mapping logic in original code:
                      // if (updates.buildCommand !== undefined) mapping.composeFile = updates.buildCommand;
                      // so 'updates' has 'buildCommand'. which is in ServiceFormData too.
                      // So Partial<ServiceFormData> is fine.

                      if (updates.buildCommand !== undefined)
                        mapping.composeFile = updates.buildCommand;
                      if (updates.startCommand !== undefined)
                        mapping.mainService = updates.startCommand;
                      if (updates.port !== undefined) mapping.port = updates.port;
                      updateData(mapping);
                    }}
                    translations={t.dashboard}
                    disabled={loading}
                  />
                ) : serviceType === 'static' ? (
                  <StaticConfigFields
                    data={{
                      buildCommand: buildCommand,
                      staticOutputDir: staticOutputDir,
                    }}
                    onChange={(updates: Partial<ServiceFormData>) => updateData(updates)}
                    translations={t.dashboard}
                    disabled={loading}
                  />
                ) : (
                  <DockerConfigFields
                    data={{
                      buildCommand: buildCommand,
                      startCommand: startCommand,
                      port: port,
                    }}
                    onChange={(updates: Partial<ServiceFormData>) => updateData(updates)}
                    translations={t.dashboard}
                    disabled={loading}
                  />
                )}
              </div>
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

              {/* Volumes Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-400">Volumes</label>
                  <button
                    type="button"
                    onClick={addVolume}
                    className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 transition-all"
                  >
                    <Plus size={12} /> Add Volume
                  </button>
                </div>

                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {volumes.length === 0 ? (
                    <div className="py-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600">
                      <Combine size={24} className="mb-2 opacity-20" />
                      <span className="text-[10px]">No volume mappings defined</span>
                    </div>
                  ) : (
                    volumes.map((vol, i) => (
                      <div
                        key={i}
                        className="flex gap-2 animate-in fade-in zoom-in-95 duration-200"
                      >
                        <input
                          type="text"
                          placeholder="/host/path:/container/path"
                          value={vol}
                          onChange={(e) => updateVolume(i, e.target.value)}
                          className="flex-1 px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeVolume(i)}
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
            <button
              type="button"
              onClick={onBack}
              className="flex-1 md:flex-none px-8 py-4 rounded-2xl font-bold bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5"
            >
              {t.common.back}
            </button>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
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
  );
}
