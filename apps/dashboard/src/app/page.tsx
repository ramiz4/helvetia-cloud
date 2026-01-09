'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Plus, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EditServiceModal } from '../components/EditServiceModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import LandingPage from '../components/LandingPage';
import { LogsModal } from '../components/LogsModal';
import { SearchBar } from '../components/SearchBar';
import { ServiceCard } from '../components/ServiceCard/ServiceCard';
import { StatsCards } from '../components/StatsCards';
import {
  createUpdateServiceMetrics,
  useDeleteService,
  useDeployService,
  useRestartService,
  useServices,
  useUpdateService,
} from '../hooks/useServices';
import { API_BASE_URL } from '../lib/config';
import { useLanguage } from '../lib/LanguageContext';
import type { Service } from '../types/service';

export default function Home() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  // Initialize authentication state - will be set after mount to avoid hydration mismatch
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // React Query hooks
  const { data: services = [], isLoading, isError, error } = useServices();
  const updateServiceMutation = useUpdateService();
  const deleteServiceMutation = useDeleteService();
  const deployServiceMutation = useDeployService();
  const restartServiceMutation = useRestartService();
  const updateMetrics = createUpdateServiceMetrics(queryClient);

  // Check authentication after mount to avoid hydration mismatch
  useEffect(() => {
    const user = localStorage.getItem('user');
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE logs stream ended - deployment finished');
      } else {
        console.log('SSE logs stream reconnecting...');
      }
    };

    return () => {
      console.log('Closing SSE logs stream');
      eventSource.close();
    };
  }, [activeDeploymentId, t.dashboard.modals.noLogs]);

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
            updateMetrics(updates);
          }
        } catch (err) {
          console.error('Error parsing metrics SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
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
  }, [isAuthenticated, updateMetrics]);

  const handleUpdateService = async (
    service: Service,
    envVarsList: Array<{ key: string; value: string }>,
  ) => {
    try {
      const envVarsObj: Record<string, string> = {};
      envVarsList.forEach((item) => {
        if (item.key.trim()) {
          envVarsObj[item.key.trim()] = item.value;
        }
      });

      await updateServiceMutation.mutateAsync({
        id: service.id,
        data: {
          name: service.name,
          repoUrl: service.repoUrl,
          branch: service.branch,
          buildCommand: service.buildCommand,
          startCommand: service.startCommand,
          port: service.type === 'STATIC' ? 80 : service.port,
          type: service.type,
          staticOutputDir: service.staticOutputDir,
          envVars: envVarsObj,
          customDomain: service.customDomain,
        },
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
      fetchLogs(deployment.id);
    } catch {
      toast.error(t.dashboard.actions.deployTriggerFailed);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm(t.dashboard.actions.deleteConfirm)) return;

    try {
      await deleteServiceMutation.mutateAsync(serviceId);
      toast.success(t.common.success);
    } catch {
      toast.error(t.dashboard.actions.deleteFailed);
    }
  };

  const handleRestart = async (serviceId: string) => {
    try {
      await restartServiceMutation.mutateAsync(serviceId);
      toast.success(t.dashboard.actions.restartSuccess);
    } catch (err) {
      const error = err instanceof Error ? err.message : t.dashboard.actions.restartFailed;
      toast.error(error);
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

  // Handle error state from React Query
  useEffect(() => {
    if (isError && error instanceof Error && error.message === 'Unauthorized') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAuthenticated(false);
      localStorage.removeItem('user');
    }
  }, [isError, error]);

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
    <ErrorBoundary>
      <div className="py-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
              {t.dashboard.title}
            </h1>
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

        <StatsCards
          totalServices={services.length}
          activeServices={activeServices}
          failedServices={failingServices}
          translations={t.dashboard}
        />

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t.dashboard.search.placeholder}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
            <p className="text-slate-500 font-medium animate-pulse text-lg">
              {t.dashboard.loading}
            </p>
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
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={setEditingService}
                onDelete={handleDelete}
                onDeploy={handleDeploy}
                onRestart={handleRestart}
                onViewLogs={fetchLogs}
                translations={t.dashboard}
              />
            ))}
          </div>
        )}

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
      </div>
    </ErrorBoundary>
  );
}
