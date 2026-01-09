'use client';

import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Edit2,
  ExternalLink,
  FileText,
  Play,
  Plus,
  RotateCw,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LandingPage from '../components/LandingPage';
import { API_BASE_URL } from '../lib/config';
import { useLanguage } from '../lib/LanguageContext';

interface Service {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  status: string;
  type: string;
  staticOutputDir?: string;
  envVars?: Record<string, string>;
  customDomain?: string;
  isPreview?: boolean;
  prNumber?: number;
  metrics?: { cpu: number; memory: number; memoryLimit: number; status?: string };
  deployments: { id: string; status: string; createdAt: string }[];
}

export default function Home() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingEnvVarsList, setEditingEnvVarsList] = useState<{ key: string; value: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchServices = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch(`${API_BASE_URL}/services`, {
      credentials: 'include',
    })
      .then((res) => {
        if (res.status === 401) {
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          return null;
        }
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data)) {
          setServices(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    // Check authentication status
    const user = localStorage.getItem('user');
    setIsAuthenticated(!!user);
  }, []);

  useEffect(() => {
    if (!activeDeploymentId) return;

    const eventSource = new EventSource(
      `${API_BASE_URL}/deployments/${activeDeploymentId}/logs/stream`,
      { withCredentials: true },
    );

    eventSource.onopen = () => console.log('SSE logs stream connected');

    eventSource.onmessage = (event) => {
      setSelectedLogs(
        (prev) => (prev === t.dashboard.modals.noLogs ? '' : prev || '') + event.data,
      );
    };

    eventSource.onerror = (_error) => {
      // Check if stream ended permanently (deployment finished or failed)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE logs stream ended - deployment finished');
        fetchServices(true); // Silent refresh when deployment ends
      } else {
        console.log('SSE logs stream reconnecting...');
      }
    };

    return () => {
      console.log('Closing SSE logs stream');
      eventSource.close();
    };
  }, [activeDeploymentId, fetchServices, t.dashboard.modals.noLogs]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchServices();
    }
  }, [isAuthenticated, fetchServices]);

  // Modal accessibility
  const logsModalRef = useRef<HTMLDivElement>(null);
  const editModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedLogs(null);
        setActiveDeploymentId(null);
        setEditingService(null);
      }
    };
    if (selectedLogs !== null || editingService !== null) {
      window.addEventListener('keydown', handleEsc);
      // Focus the modal for accessibility
      if (selectedLogs !== null) logsModalRef.current?.focus();
      if (editingService !== null) editModalRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedLogs, editingService]);

  useEffect(() => {
    if (isAuthenticated) {
      const eventSource = new EventSource(`${API_BASE_URL}/services/metrics/stream`, {
        withCredentials: true,
      });

      eventSource.onopen = () => console.log('SSE metrics stream connected');

      eventSource.onmessage = (event) => {
        try {
          const updates = JSON.parse(event.data);
          if (Array.isArray(updates)) {
            setServices((prev) =>
              prev.map((service) => {
                const update = updates.find((u) => u.id === service.id);
                if (update && update.metrics) {
                  return {
                    ...service,
                    metrics: update.metrics,
                    // Real-time status update from the metrics stream
                    status: update.metrics.status || service.status,
                  };
                }
                return service;
              }),
            );
          }
        } catch (err) {
          console.error('Error parsing metrics SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        // EventSource automatically reconnects on transient errors (network issues, server restart)
        // Only log if it's a permanent failure (readyState === CLOSED)
        if (eventSource.readyState === EventSource.CLOSED) {
          console.error('SSE metrics stream closed permanently:', error);
        } else {
          console.log('SSE metrics stream reconnecting...');
        }
      };

      return () => {
        console.log('Closing SSE metrics stream');
        eventSource.close();
      };
    }
  }, [isAuthenticated]);

  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
    };
  };

  const updateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      // Convert envVarsList to object
      const envVarsObj: Record<string, string> = {};
      editingEnvVarsList.forEach((item) => {
        if (item.key.trim()) {
          envVarsObj[item.key.trim()] = item.value;
        }
      });

      const res = await fetch(`${API_BASE_URL}/services/${editingService.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: editingService.name,
          repoUrl: editingService.repoUrl,
          branch: editingService.branch,
          buildCommand: editingService.buildCommand,
          startCommand: editingService.startCommand,
          port: editingService.type === 'STATIC' ? 80 : editingService.port,
          type: editingService.type,
          staticOutputDir: editingService.staticOutputDir,
          envVars: envVarsObj,
          customDomain: editingService.customDomain,
        }),
      });

      if (res.ok) {
        toast.success(t.common.success);
        setEditingService(null);
        fetchServices(true);
      } else {
        toast.error(t.dashboard.actions.updateFailed);
      }
    } catch {
      toast.error(t.common.apiError);
    }
  };

  const triggerDeploy = async (serviceId: string) => {
    // Optimistic update
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: 'DEPLOYING' } : s)),
    );

    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}/deploy`, {
        method: 'POST',
        credentials: 'include',
      });
      const deployment = await res.json();

      // Open logs immediately for the new deployment
      fetchLogs(deployment.id);

      // Refresh services to sync with DB
      fetchServices();
    } catch {
      toast.error(t.dashboard.actions.deployTriggerFailed);
      // Revert if failed (optional, but fetchServices will fix it anyway)
      fetchServices();
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm(t.dashboard.actions.deleteConfirm)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(t.common.success);
        setServices(services.filter((s) => s.id !== serviceId));
      } else {
        toast.error(t.dashboard.actions.deleteFailed);
      }
    } catch {
      toast.error(t.common.apiError);
    }
  };

  const fetchLogs = async (deploymentId: string) => {
    setActiveDeploymentId(deploymentId);
    try {
      const res = await fetch(`${API_BASE_URL}/deployments/${deploymentId}/logs`, {
        credentials: 'include',
      });
      const data = await res.json();
      setSelectedLogs(data.logs || t.dashboard.modals.noLogs);
    } catch {
      toast.error(t.dashboard.actions.fetchLogsFailed);
    }
  };

  const fetchService = async (serviceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const updatedService = await res.json();
        setServices((prev) => prev.map((s) => (s.id === serviceId ? updatedService : s)));
      } else {
        toast.error(t.dashboard.modals.refreshFailed);
      }
    } catch (err) {
      console.error(err);
      toast.error(t.dashboard.modals.refreshError);
    }
  };

  const restartService = async (serviceId: string) => {
    // Optimistic update
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, status: 'DEPLOYING' } : s)),
    );

    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}/restart`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(t.dashboard.actions.restartSuccess);
        fetchService(serviceId);
      } else {
        const error = await res.json();
        toast.error(error.error || t.dashboard.actions.restartFailed);
      }
    } catch {
      toast.error(t.common.apiError);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
        <p className="text-slate-500 font-medium animate-pulse text-lg">{t.dashboard.loading}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Dashboard View
  // Note: Status values - Worker and Docker metrics provide 'RUNNING', 'DEPLOYING', 'STOPPED', 'FAILED'
  const activeServices = services.filter(
    (s) => s.status === 'RUNNING' || s.status === 'DEPLOYING',
  ).length;
  const failingServices = services.filter((s) => s.status === 'FAILED').length;

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.repoUrl.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">{t.dashboard.title}</h1>
          <p className="text-slate-400 text-lg">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex gap-4">
          <a
            href="/new"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 gap-2"
          >
            <Plus size={20} />
            {t.dashboard.createNewService}
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-lg">
              <Zap size={24} />
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1 leading-none">
                {services.length}
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                {t.dashboard.stats.total}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1 leading-none">
                {activeServices}
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                {t.dashboard.stats.active}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20 shadow-lg">
              <AlertCircle size={24} />
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-1 leading-none">
                {failingServices}
              </div>
              <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                {t.dashboard.stats.failed}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md mb-12">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder={t.dashboard.search.placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-lg"
          aria-label={t.dashboard.search.placeholder}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
          <p className="text-slate-500 font-medium animate-pulse text-lg">{t.dashboard.loading}</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-[32px] text-center p-20 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-indigo-500/5 to-transparent" />
          <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center relative z-10 ring-8 ring-white/5">
            <Zap size={40} className="text-slate-500" />
          </div>
          <div className="relative z-10 max-w-md">
            <h3 className="text-3xl font-bold text-white mb-4">{t.dashboard.search.noResults}</h3>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              {searchQuery ? t.dashboard.search.tryAgain : t.dashboard.search.getStarted}
            </p>
            {!searchQuery && (
              <a
                href="/new"
                className="inline-flex items-center justify-center px-10 py-5 rounded-2xl font-bold text-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:-translate-y-1 shadow-xl shadow-indigo-500/30"
              >
                {t.dashboard.createNewService}
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 group shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-white tracking-tight leading-none">
                    {service.name}
                  </h3>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm ${service.status === 'RUNNING'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                        : service.status === 'DEPLOYING'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse'
                          : service.status === 'FAILED'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/20'
                            : 'bg-slate-500/15 text-slate-400 border-slate-500/20'
                        }`}
                    >
                      {service.status === 'NOT_RUNNING'
                        ? t.dashboard.status.notRunning
                        : service.status}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${service.type === 'STATIC'
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                        : 'bg-purple-500/15 text-purple-400 border-purple-500/20'
                        }`}
                    >
                      {service.type === 'STATIC'
                        ? t.dashboard.newService.staticSite
                        : service.type === 'COMPOSE'
                          ? t.dashboard.newService.composeStack
                          : t.dashboard.newService.dockerService}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingService(service);
                      if (service.envVars) {
                        setEditingEnvVarsList(
                          Object.entries(service.envVars).map(([key, value]) => ({ key, value })),
                        );
                      } else {
                        setEditingEnvVarsList([]);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    title={t.dashboard.actions.edit}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
                    className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                    title={t.dashboard.actions.delete}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-500 mb-8 pb-4 border-b border-white/5">
                <div className="w-2 h-2 rounded-full bg-slate-600 shadow-[0_0_8px_rgba(71,85,105,0.5)]" />
                <span className="truncate font-medium">{service.repoUrl}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-indigo-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-indigo-400 transition-colors">
                    <Cpu size={14} className="opacity-70" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      {t.dashboard.labels.cpu}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {service.metrics?.cpu || 0}
                    <span className="text-sm font-medium text-slate-500 ml-1">%</span>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-amber-500/20 transition-colors">
                  <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-amber-400 transition-colors">
                    <Zap size={14} className="opacity-70" />
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      {t.dashboard.labels.ram}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white tabular-nums tracking-tight">
                    {service.metrics?.memory || 0}
                    <span className="text-sm font-medium text-slate-500 ml-1">MB</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-auto">
                <button
                  onClick={() => triggerDeploy(service.id)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:shadow-[0_8px_20px_rgba(99,102,241,0.3)] shadow-lg active:scale-95"
                >
                  <Play size={18} fill="currentColor" /> {t.dashboard.actions.redeploy}
                </button>

                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => restartService(service.id)}
                    className="flex items-center justify-center py-3.5 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm active:scale-95 group/btn"
                    title={t.dashboard.actions.restart}
                  >
                    <RotateCw
                      size={18}
                      className="group-active/btn:rotate-180 transition-transform duration-500"
                    />
                  </button>
                  <button
                    onClick={() => service.deployments[0] && fetchLogs(service.deployments[0].id)}
                    className="flex items-center justify-center py-3.5 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group/btn"
                    disabled={!service.deployments[0]}
                    title={t.dashboard.actions.logs}
                  >
                    <FileText size={18} />
                  </button>
                  <a
                    href={`http://${service.name}.localhost`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center py-3.5 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm active:scale-95"
                    title={t.dashboard.actions.visit}
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Modal */}
      {selectedLogs !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-100 p-8">
          <div
            ref={logsModalRef}
            tabIndex={-1}
            className="glass w-full max-w-4xl max-h-[85vh] flex flex-col rounded-[32px] overflow-hidden focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-modal-title"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-indigo-400" />
                <h2 id="logs-modal-title" className="text-xl font-bold text-white">
                  {t.dashboard.modals.logsTitle}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedLogs(null);
                  setActiveDeploymentId(null);
                }}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-black/40 custom-scrollbar">
              <pre className="font-mono text-sm text-slate-300 whitespace-pre-wrap underline-offset-4 leading-relaxed">
                {selectedLogs}
              </pre>
            </div>
            <div className="p-4 border-t border-white/10 bg-slate-900/50 text-xs font-medium text-slate-500 tracking-wider uppercase">
              {activeDeploymentId ? t.dashboard.modals.streaming : t.dashboard.modals.ended}
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div
            ref={editModalRef}
            tabIndex={-1}
            className="w-full max-w-2xl bg-[#0d121f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5 shrink-0">
              <h2 id="edit-modal-title" className="text-xl font-bold text-white tracking-tight">
                {t.dashboard.modals.editTitle}
              </h2>
              <button
                onClick={() => setEditingService(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <form id="edit-service-form" onSubmit={updateService} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    {t.dashboard.labels.serviceName}
                  </label>
                  <input
                    type="text"
                    value={editingService.name}
                    onChange={(e) =>
                      setEditingService((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    {t.dashboard.labels.repoUrl}
                  </label>
                  <input
                    type="text"
                    value={editingService.repoUrl}
                    onChange={(e) =>
                      setEditingService((prev) =>
                        prev ? { ...prev, repoUrl: e.target.value } : null,
                      )
                    }
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {t.dashboard.labels.serviceType}
                    </label>
                    <div className="relative">
                      <select
                        value={editingService.type || 'DOCKER'}
                        onChange={(e) =>
                          setEditingService((prev) =>
                            prev
                              ? {
                                ...prev,
                                type: e.target.value,
                                port: e.target.value === 'STATIC' ? 80 : prev.port,
                              }
                              : null,
                          )
                        }
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium appearance-none"
                      >
                        <option value="DOCKER">{t.dashboard.newService.dockerService}</option>
                        <option value="STATIC">{t.dashboard.newService.staticSite}</option>
                        <option value="COMPOSE">{t.dashboard.newService.composeStack}</option>
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

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {t.dashboard.labels.branch}
                    </label>
                    <input
                      type="text"
                      value={editingService.branch || ''}
                      onChange={(e) =>
                        setEditingService((prev) =>
                          prev ? { ...prev, branch: e.target.value } : null,
                        )
                      }
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                      placeholder="main"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {editingService.type !== 'STATIC' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                        {editingService.type === 'COMPOSE'
                          ? t.dashboard.labels.composeFile
                          : t.dashboard.labels.buildCommand}
                      </label>
                      <input
                        type="text"
                        value={editingService.buildCommand || ''}
                        onChange={(e) =>
                          setEditingService((prev) =>
                            prev ? { ...prev, buildCommand: e.target.value } : null,
                          )
                        }
                        className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                        placeholder={
                          editingService.type === 'COMPOSE' ? 'docker-compose.yml' : 'npm run build'
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {editingService.type === 'STATIC'
                        ? t.dashboard.labels.outputDir
                        : editingService.type === 'COMPOSE'
                          ? t.dashboard.labels.mainService
                          : t.dashboard.labels.startCommand}
                    </label>
                    <input
                      type="text"
                      value={
                        editingService.type === 'STATIC'
                          ? editingService.staticOutputDir || ''
                          : editingService.startCommand || ''
                      }
                      onChange={(e) =>
                        setEditingService((prev) =>
                          prev
                            ? editingService.type === 'STATIC'
                              ? { ...prev, staticOutputDir: e.target.value }
                              : { ...prev, startCommand: e.target.value }
                            : null,
                        )
                      }
                      className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                      placeholder={editingService.type === 'STATIC' ? 'dist' : 'npm start'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                    {t.dashboard.labels.port}
                  </label>
                  <input
                    type="number"
                    value={editingService.port || 3000}
                    onChange={(e) =>
                      setEditingService((prev) =>
                        prev ? { ...prev, port: parseInt(e.target.value) } : null,
                      )
                    }
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium disabled:opacity-50"
                    disabled={editingService.type === 'STATIC'}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {t.dashboard.labels.envVars}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingEnvVarsList((prev) => [...prev, { key: '', value: '' }])
                      }
                      className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 transition-all"
                    >
                      <Plus size={12} /> {t.dashboard.newService.addVariable}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {editingEnvVarsList.length === 0 ? (
                      <div className="py-8 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-600">
                        <span className="text-xs">{t.dashboard.newService.noEnvVars}</span>
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
                onClick={() => setEditingService(null)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-white/5 transition-all"
              >
                {t.dashboard.actions.cancel}
              </button>
              <button
                type="submit"
                form="edit-service-form"
                className="px-8 py-2.5 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                {t.dashboard.actions.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
