import { useLanguage } from '@/lib/LanguageContext';
import { ChevronRight, Container, Database, FileCode, Github } from 'lucide-react';
import { useState } from 'react';
import GitHubImagePicker from '../GitHubImagePicker';
import GitHubRepoPicker from '../GitHubRepoPicker';
import { DbEngine, ImportType, ServiceFormData } from './types';

interface ImportSourceStepProps {
  data: ServiceFormData;
  updateData: (data: Partial<ServiceFormData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ImportSourceStep({
  data,
  updateData,
  onNext,
  onBack,
}: ImportSourceStepProps) {
  const { t } = useLanguage();
  const [localRepoUrl, setLocalRepoUrl] = useState(data.repoUrl || '');

  // Local state for import type to allow switching without committing to global state immediately if needed,
  // but simpler to use updateData directly for importType.
  const { importType } = data;

  const setImportType = (type: ImportType) => updateData({ importType: type });

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { id: 'github', label: t.dashboard.newService.importGithub, icon: Github },
          { id: 'github-image', label: 'GitHub Container', icon: Container },
          { id: 'database', label: t.dashboard.newService.importDatabase, icon: Database },
          { id: 'manual', label: t.dashboard.newService.importManual, icon: FileCode },
        ].map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setImportType(type.id as ImportType);
              // Clear repo/branch when switching types to avoid confusion?
              // updateData({ repoUrl: '', branch: 'main' });
            }}
            className={`p-6 rounded-2xl flex flex-col items-center justify-center gap-3 border transition-all active:scale-95 ${importType === type.id
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
            onSelect={(url, branch, name) => {
              updateData({ repoUrl: url, branch: branch, projectName: name });
              onNext();
            }}
          />
        )}

        {importType === 'github-image' && (
          <GitHubImagePicker
            onSelect={(url, name) => {
              updateData({ repoUrl: url, branch: 'latest', projectName: name });
              onNext();
            }}
          />
        )}

        {['manual', 'database'].includes(importType) &&
          importType !== 'github' &&
          importType !== 'github-image' && (
            <div className="space-y-6 max-w-xl mx-auto py-12">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
                  {importType === 'database' ? <Database size={32} /> : <FileCode size={32} />}
                </div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                  {importType === 'database'
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
                      value={localRepoUrl}
                      onChange={(e) => {
                        setLocalRepoUrl(e.target.value);
                        updateData({ repoUrl: e.target.value });
                      }}
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
                      value={data.dbEngine}
                      onChange={(e) => updateData({ dbEngine: e.target.value as DbEngine })}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white cursor-pointer appearance-none transition-all"
                    >
                      <option value="postgres">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                      <option value="redis">Redis</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={onBack}
                    className="flex-1 h-12 bg-white/5 text-slate-400 font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5"
                  >
                    {t.common.back}
                  </button>
                  <button
                    onClick={() => {
                      if (importType !== 'database') {
                        updateData({ repoUrl: localRepoUrl });
                      }
                      onNext();
                    }}
                    disabled={importType !== 'database' && !localRepoUrl}
                    className="flex-1 h-12 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {t.common.next}
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* Generic Back Button if not in specific flow (so users can go back to Step 1) */}
        {!importType && (
          <div className="mt-8 flex justify-end">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-white/5 text-slate-400 font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/5"
            >
              {t.common.back}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
