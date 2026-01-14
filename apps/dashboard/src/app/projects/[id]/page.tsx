'use client';

import { ConfirmationModal } from 'shared';
import { EditServiceModal } from '@/components/EditServiceModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LogsModal } from '@/components/LogsModal';
import { NewEnvironmentModal } from '@/components/NewEnvironmentModal';
import { ServiceCard } from '@/components/ServiceCard/ServiceCard';

import { useCreateEnvironment, useProject } from '@/hooks/useProjects';
import {
  createUpdateServiceMetrics,
  useDeleteService,
  useDeployService,
  useRestartService,
  useServices,
  useStopService,
  useUpdateService,
} from '@/hooks/useServices';
import { API_BASE_URL } from 'shared';
import { useLanguage } from 'shared';
import { checkAndRefreshToken, fetchWithAuth } from '@/lib/tokenRefresh';
import type { Service } from '@/types/service';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, Box, Layout, Loader2, Plus, Settings, Shield } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [showNewEnvironmentModal, setShowNewEnvironmentModal] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: services = [], isLoading: servicesLoading } = useServices({
    enabled: !!isAuthenticated,
  });

  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();
  const deployServiceMutation = useDeployService();
  const restartServiceMutation = useRestartService();
  const stopServiceMutation = useStopService();
  const createEnvironmentMutation = useCreateEnvironment();
  const updateMetrics = createUpdateServiceMetrics(queryClient);

  useEffect(() => {
    const initAuth = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const refreshed = await checkAndRefreshToken();
        setIsAuthenticated(refreshed);
      } else {
        setIsAuthenticated(false);
        router.push('/login');
      }
    };
    initAuth();
  }, [router]);

  useEffect(() => {
    if (!activeDeploymentId) return;
    const eventSource = new EventSource(
      `${API_BASE_URL}/deployments/${activeDeploymentId}/logs/stream`,
      { withCredentials: true },
    );
    eventSource.onmessage = (event) => {
      setSelectedLogs(
        (prev) => (prev === t.dashboard.modals.noLogs ? '' : prev || '') + event.data,
      );
    };
    return () => eventSource.close();
  }, [activeDeploymentId, t.dashboard.modals.noLogs]);

  useEffect(() => {
    if (isAuthenticated) {
      const eventSource = new EventSource(`${API_BASE_URL}/services/metrics/stream`, {
        withCredentials: true,
      });
      eventSource.onmessage = (event) => {
        try {
          const updates = JSON.parse(event.data);
          if (Array.isArray(updates)) updateMetrics(updates);
        } catch (err) {
          console.error('Error parsing metrics SSE message:', err);
        }
      };
      return () => eventSource.close();
    }
  }, [isAuthenticated, updateMetrics]);

  const handleUpdateService = async (
    service: Service,
    envVarsList: Array<{ key: string; value: string }>,
  ) => {
    try {
      const envVarsObj: Record<string, string> = {};
      envVarsList.forEach((item) => {
        if (item.key.trim()) envVarsObj[item.key.trim()] = item.value;
      });
      await updateServiceMutation.mutateAsync({
        id: service.id,
        data: { ...service, envVars: envVarsObj },
      });
      toast.success(t.common.success);
      setEditingService(null);
    } catch {
      toast.error(t.dashboard.actions.updateFailed);
    }
  };

  const handleDeploy = async (serviceId: string) => {
    try {
      const deployment = await deployServiceMutation.mutateAsync(serviceId);
      setActiveDeploymentId(deployment.id);
      const res = await fetchWithAuth(`${API_BASE_URL}/deployments/${deployment.id}/logs`);
      const data = await res.json();
      setSelectedLogs(data.logs || t.dashboard.modals.noLogs);
    } catch {
      toast.error(t.dashboard.actions.deployTriggerFailed);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    try {
      await deleteServiceMutation.mutateAsync(serviceToDelete);
      toast.success(t.common.success);
      setServiceToDelete(null);
    } catch {
      toast.error(t.dashboard.actions.deleteFailed);
    }
  };

  const handleRestart = async (serviceId: string) => {
    try {
      await restartServiceMutation.mutateAsync(serviceId);
      toast.success(t.dashboard.actions.restartSuccess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.dashboard.actions.restartFailed);
    }
  };

  const handleStop = async (serviceId: string) => {
    try {
      await stopServiceMutation.mutateAsync(serviceId);
      toast.success(t.dashboard.actions.stopSuccess);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.dashboard.actions.stopFailed);
    }
  };

  const handleCreateEnvironment = async (name: string) => {
    try {
      await createEnvironmentMutation.mutateAsync({ projectId: id, name });
      toast.success(t.dashboard.actions.createEnvSuccess);
      setShowNewEnvironmentModal(false);
    } catch {
      toast.error(t.dashboard.actions.createEnvFailed);
    }
  };

  if (projectLoading || servicesLoading || isAuthenticated === null) {
    return (
      <div className="flex flex-col items-center justify-center py-64 gap-6">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">
          {t.dashboard.project.loading}
        </p>
      </div>
    );
  }

  if (!project) return <div>{t.dashboard.project.notFound}</div>;

  // Filter services that belong to this project
  // Since we haven't fully migrated all services to always have an environmentId,
  // we'll eventually need a way to link them.
  // For now, let's assume services are filtered by environmentIds in the project.
  const environmentIds = project.environments?.map((e) => e.id) || [];
  const projectServices = services.filter(
    (s) => s.environmentId && environmentIds.includes(s.environmentId),
  );

  const stats = {
    total: projectServices.length,
    active: projectServices.filter((s) => s.status === 'RUNNING').length,
    failed: projectServices.filter((s) => s.status === 'FAILED').length,
  };

  return (
    <ErrorBoundary>
      <div className="py-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest mb-8 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            {t.dashboard.project.backToProjects}
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
                  <Layout size={32} />
                </div>
                <div>
                  <h1 className="text-6xl font-black text-white tracking-tighter leading-none">
                    {project.name}
                  </h1>
                  <div className="flex items-center gap-3 mt-4">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {t.dashboard.project.id} {id.slice(0, 8)}...
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                      {t.dashboard.project.globalStatus} {t.dashboard.project.statusActive}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button className="h-14 px-8 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 flex items-center gap-3 active:scale-95 shadow-xl">
                <Settings size={20} />
                {t.dashboard.project.settings}
              </button>
              <button
                onClick={() => setShowNewEnvironmentModal(true)}
                className="h-14 px-8 rounded-2xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all border border-white/10 flex items-center gap-3 active:scale-95 shadow-xl"
              >
                <Plus size={20} />
                {t.dashboard.project.newEnvironment}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <div className="md:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                  <Box size={14} className="text-indigo-400" />
                  {t.dashboard.stats.total}
                </div>
                <div className="text-5xl font-black text-white tracking-tighter leading-none">
                  {stats.total}
                </div>
              </div>
              <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                  <Activity size={14} className="text-emerald-400" />
                  {t.dashboard.stats.active}
                </div>
                <div className="text-5xl font-black text-white tracking-tighter leading-none">
                  {stats.active}
                </div>
              </div>
              <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                  <Shield size={14} className="text-rose-400" />
                  {t.dashboard.stats.failed}
                </div>
                <div className="text-5xl font-black text-white tracking-tighter leading-none">
                  {stats.failed}
                </div>
              </div>
            </div>
          </div>
          {/* <div className="p-8 rounded-[32px] bg-linear-to-br from-indigo-500 to-purple-600 shadow-2xl flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            <div className="relative z-10">
              <Globe className="text-white/80 mb-6" size={32} />
              <h3 className="text-white font-black text-xl leading-tight">Project Health</h3>
              <p className="text-white/60 text-xs mt-2 font-bold uppercase tracking-widest">
                100% Operational
              </p>
            </div>
            <div className="relative z-10 mt-8">
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-full bg-white animate-pulse" />
              </div>
            </div>
          </div> */}
        </div>

        {project.environments?.map((env) => {
          const envServices = services
            .filter((s) => s.environmentId === env.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          return (
            <div key={env.id} className="mb-20 animate-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <div className="flex items-center gap-4">
                  <h2 className="text-3xl font-black text-white tracking-tight leading-none capitalize">
                    {env.name}
                  </h2>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {t.dashboard.project.environment}
                  </span>
                </div>
                <Link
                  href={`/new?project=${id}&env=${env.id}`}
                  className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-black text-xs uppercase tracking-widest transition-colors group"
                >
                  <Plus size={16} />
                  {t.dashboard.project.addServiceTo.replace('{name}', env.name)}
                </Link>
              </div>

              {envServices.length === 0 ? (
                <div className="p-16 rounded-[40px] bg-slate-900/20 border border-dashed border-white/10 flex flex-col items-center gap-6 text-center group hover:bg-slate-900/30 transition-all">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:text-indigo-400 transition-all duration-500">
                    <Box size={32} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">
                      {t.dashboard.project.noServices}
                    </h4>
                    <p className="text-slate-500 max-w-sm font-medium">
                      {t.dashboard.project.deployFirstService}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {envServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onEdit={setEditingService}
                      onDelete={() => setServiceToDelete(service.id)}
                      onDeploy={handleDeploy}
                      onRestart={handleRestart}
                      onStop={handleStop}
                      onViewLogs={async (id) => {
                        setActiveDeploymentId(id);
                        const res = await fetchWithAuth(`${API_BASE_URL}/deployments/${id}/logs`);
                        const data = await res.json();
                        setSelectedLogs(data.logs || t.dashboard.modals.noLogs);
                      }}
                      translations={t.dashboard}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {selectedLogs !== null && (
          <LogsModal
            logs={selectedLogs}
            isStreaming={!!activeDeploymentId}
            onClose={() => {
              setSelectedLogs(null);
              setActiveDeploymentId(null);
            }}
            translations={t.dashboard}
          />
        )}

        {editingService !== null && (
          <EditServiceModal
            service={editingService}
            onClose={() => setEditingService(null)}
            onSave={handleUpdateService}
            translations={t.dashboard}
          />
        )}

        {showNewEnvironmentModal && (
          <NewEnvironmentModal
            onClose={() => setShowNewEnvironmentModal(false)}
            onSave={handleCreateEnvironment}
          />
        )}

        {serviceToDelete && (
          <ConfirmationModal
            title={t.dashboard.actions.delete}
            message={t.dashboard.actions.deleteConfirm}
            confirmLabel={t.dashboard.actions.delete}
            onConfirm={handleDelete}
            onCancel={() => setServiceToDelete(null)}
            isDanger
            isLoading={deleteServiceMutation.isPending}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
