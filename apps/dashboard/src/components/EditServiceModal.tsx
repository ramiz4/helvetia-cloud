'use client';

import FocusTrap from '@/components/FocusTrap';
import type { Service, ServiceType } from '@/types/service';
import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  ComposeConfigFields,
  DockerConfigFields,
  GHCRConfigFields,
  StaticConfigFields,
} from './service-forms';

interface EditServiceModalProps {
  service: Service;
  onClose: () => void;
  onSave: (service: Service, envVarsList: Array<{ key: string; value: string }>) => Promise<void>;
  translations: {
    modals: {
      editTitle: string;
    };
    labels: {
      serviceName: string;
      repoUrl: string;
      serviceType: string;
      branch: string;
      buildCommand: string;
      composeFile: string;
      outputDir: string;
      startCommand: string;
      mainService: string;
      port: string;
      envVars: string;
    };
    newService: {
      dockerService: string;
      staticSite: string;
      composeStack: string;
      addVariable: string;
      noEnvVars: string;
    };
    actions: {
      cancel: string;
      save: string;
    };
  };
}

export function EditServiceModal({
  service: initialService,
  onClose,
  onSave,
  translations: t,
}: EditServiceModalProps) {
  const [editingService, setEditingService] = useState<Service>(initialService);
  const [editingEnvVarsList, setEditingEnvVarsList] = useState<{ key: string; value: string }[]>(
    initialService.envVars
      ? Object.entries(initialService.envVars).map(([key, value]) => ({ key, value }))
      : [],
  );
  const editModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    editModalRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(editingService, editingEnvVarsList);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
      <FocusTrap active={true} onEscape={onClose}>
        <div
          ref={editModalRef}
          className="w-full max-w-2xl bg-[#0d121f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 shrink-0">
            <h2 id="edit-modal-title" className="text-xl font-bold text-white tracking-tight">
              {t.modals.editTitle}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Close edit dialog"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <form id="edit-service-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  {t.labels.serviceName}
                </label>
                <input
                  type="text"
                  value={editingService.name}
                  onChange={(e) => setEditingService((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  {t.labels.repoUrl}
                </label>
                <input
                  type="text"
                  value={editingService.repoUrl}
                  onChange={(e) =>
                    setEditingService((prev) => ({ ...prev, repoUrl: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    {t.labels.serviceType}
                  </label>
                  <div className="relative">
                    <select
                      value={editingService.type || 'DOCKER'}
                      onChange={(e) =>
                        setEditingService((prev) => ({
                          ...prev,
                          type: e.target.value as ServiceType,
                          port: e.target.value === 'STATIC' ? 80 : prev.port,
                        }))
                      }
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                    >
                      <option value="DOCKER">{t.newService.dockerService}</option>
                      <option value="STATIC">{t.newService.staticSite}</option>
                      <option value="COMPOSE">{t.newService.composeStack}</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </div>
                </div>

                {!editingService.repoUrl?.includes('ghcr.io') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {t.labels.branch}
                    </label>
                    <input
                      type="text"
                      value={editingService.branch || ''}
                      onChange={(e) =>
                        setEditingService((prev) => ({ ...prev, branch: e.target.value }))
                      }
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium font-mono"
                      placeholder="main"
                    />
                  </div>
                )}
              </div>

              {/* Specialized Form Fields */}
              <div className="pt-2">
                {editingService.type === 'COMPOSE' ? (
                  <ComposeConfigFields
                    data={editingService}
                    onChange={(updates: Partial<Service>) =>
                      setEditingService((prev) => ({ ...prev, ...updates }))
                    }
                    translations={{ dashboard: { labels: t.labels, newService: t.newService } }}
                  />
                ) : editingService.type === 'STATIC' ? (
                  <StaticConfigFields
                    data={editingService}
                    onChange={(updates: Partial<Service>) =>
                      setEditingService((prev) => ({ ...prev, ...updates }))
                    }
                    translations={{ dashboard: { labels: t.labels, newService: t.newService } }}
                  />
                ) : editingService.repoUrl?.includes('ghcr.io') ? (
                  <GHCRConfigFields
                    data={editingService}
                    onChange={(updates: Partial<Service>) =>
                      setEditingService((prev) => ({ ...prev, ...updates }))
                    }
                    translations={{ dashboard: { labels: t.labels, newService: t.newService } }}
                  />
                ) : (
                  <DockerConfigFields
                    data={editingService}
                    onChange={(updates: Partial<Service>) =>
                      setEditingService((prev) => ({ ...prev, ...updates }))
                    }
                    translations={{ dashboard: { labels: t.labels, newService: t.newService } }}
                  />
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    {t.labels.envVars}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingEnvVarsList((prev) => [...prev, { key: '', value: '' }])
                    }
                    className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 transition-all"
                  >
                    <Plus size={12} /> {t.newService.addVariable}
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {editingEnvVarsList.length === 0 ? (
                    <div className="py-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600">
                      <span className="text-xs">{t.newService.noEnvVars}</span>
                    </div>
                  ) : (
                    editingEnvVarsList.map((ev, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="KEY"
                          value={ev.key}
                          onChange={(e) => {
                            const newList = [...editingEnvVarsList];
                            newList[i].key = e.target.value;
                            setEditingEnvVarsList(newList);
                          }}
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono text-xs"
                        />
                        <input
                          type="text"
                          placeholder="VALUE"
                          value={ev.value}
                          onChange={(e) => {
                            const newList = [...editingEnvVarsList];
                            newList[i].value = e.target.value;
                            setEditingEnvVarsList(newList);
                          }}
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingEnvVarsList((prev) => prev.filter((_, idx) => idx !== i))
                          }
                          className="p-2 bg-white/5 text-slate-500 hover:text-rose-400 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-white/5 shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all"
            >
              {t.actions.cancel}
            </button>
            <button
              type="submit"
              form="edit-service-form"
              className="px-8 py-2.5 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
            >
              {t.actions.save}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
