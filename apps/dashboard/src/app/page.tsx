'use client';

import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Edit2,
  ExternalLink,
  FileText,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LandingPage from '../components/LandingPage';
import { API_BASE_URL, WS_BASE_URL } from '../lib/config';
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
  metrics?: { cpu: number; memory: number; memoryLimit: number };
  deployments: { id: string; status: string; createdAt: string }[];
}

export default function Home() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
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

    const socket = new WebSocket(`${WS_BASE_URL}/deployments/${activeDeploymentId}/logs/stream`);

    socket.onopen = () => console.log('WebSocket connected');
    socket.onmessage = (event) => {
      setSelectedLogs((prev) => (prev === 'No logs available.' ? '' : prev || '') + event.data);
    };
    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      fetchServices(true); // Silent refresh when deployment ends
    };

    return () => socket.close();
  }, [activeDeploymentId, fetchServices]); // Re-run when target deployment changes

  useEffect(() => {
    if (isAuthenticated) {
      fetchServices();
    }
  }, [isAuthenticated, fetchServices]);

  // Use a ref to avoid stale closures in the metrics interval
  // and to avoid unnecessary interval resets when services change.
  const servicesRef = useRef(services);
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

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
      const fetchMetrics = async () => {
        const currentServices = servicesRef.current;
        if (currentServices.length === 0) return;

        const metricsPromises = currentServices.map(async (service) => {
          try {
            const res = await fetch(`${API_BASE_URL}/services/${service.id}/metrics`, {
              credentials: 'include',
            });
            const metrics = await res.json();
            return { id: service.id, metrics };
          } catch {
            return { id: service.id, metrics: null };
          }
        });

        const updates = await Promise.all(metricsPromises);

        setServices((prev) =>
          prev.map((service) => {
            const update = updates.find((u) => u.id === service.id);
            return update && update.metrics ? { ...service, metrics: update.metrics } : service;
          }),
        );
      };

      const interval = setInterval(fetchMetrics, 5000); // Poll metrics every 5s
      return () => clearInterval(interval);
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
          envVars: editingService.envVars,
          customDomain: editingService.customDomain,
        }),
      });

      if (res.ok) {
        setServices(
          services.map((s) => (s.id === editingService.id ? { ...s, ...editingService } : s)),
        );
        setEditingService(null);
      } else {
        toast.error('Failed to update service');
      }
    } catch {
      toast.error('Error connecting to API');
    }
  };

  const triggerDeploy = async (serviceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}/deploy`, {
        method: 'POST',
        credentials: 'include',
      });
      const deployment = await res.json();

      // Open logs immediately for the new deployment
      fetchLogs(deployment.id);

      // Refresh services
      fetchServices();
    } catch {
      toast.error('Failed to trigger deployment');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this service?\n\nThis will stop the app and remove all data.',
      )
    )
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setServices(services.filter((s) => s.id !== serviceId));
      } else {
        toast.error('Failed to delete service');
      }
    } catch {
      toast('Error connecting to API');
    }
  };

  const fetchLogs = async (deploymentId: string) => {
    setActiveDeploymentId(deploymentId);
    try {
      const res = await fetch(`${API_BASE_URL}/deployments/${deploymentId}/logs`, {
        credentials: 'include',
      });
      const data = await res.json();
      setSelectedLogs(data.logs || 'No logs available.');
    } catch {
      toast.error('Failed to fetch logs');
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const restartService = async (serviceId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/services/${serviceId}/restart`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Container restarted successfully!');
        fetchService(serviceId);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to restart container');
      }
    } catch {
      toast.error('Error connecting to API');
    }
  };

  if (isAuthenticated === null) {
    return null; // or a loading spinner
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Dashboard View
  // Note: Status values - Worker sets 'ACTIVE' on successful deployment, 'FAILED' on failure
  // API may also return 'RUNNING', 'STOPPED', 'IDLE' based on Docker container state
  const activeServices = services.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'RUNNING' || s.status === 'DEPLOYING',
  ).length;
  const failingServices = services.filter(
    (s) => s.status === 'FAILED' || s.status === 'ERROR',
  ).length;

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.repoUrl.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="section">
      <div
        className="header-actions"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1>{t.dashboard.title}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>{t.dashboard.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => fetchServices()} className="btn btn-ghost" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        className="grid"
        style={{
          marginBottom: '2rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        }}
      >
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="logo-icon"
              style={{
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--primary)',
                boxShadow: 'none',
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>
                {services.length}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t.dashboard.stats.total}
              </div>
            </div>
          </div>
        </div>
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="logo-icon"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--success)',
                boxShadow: 'none',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>
                {activeServices}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t.dashboard.stats.active}
              </div>
            </div>
          </div>
        </div>
        <div className="card glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              className="logo-icon"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--error)',
                boxShadow: 'none',
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>
                {failingServices}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {t.dashboard.stats.failed}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            placeholder={t.dashboard.search.placeholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
            aria-label={t.dashboard.search.placeholder}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner"></div>
        </div>
      ) : filteredServices.length === 0 ? (
        <div
          className="card glass"
          style={{
            textAlign: 'center',
            padding: '4rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '50%' }}>
            <Zap size={32} color="var(--text-secondary)" />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.5rem' }}>{t.dashboard.search.noResults}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {searchQuery ? t.dashboard.search.tryAgain : t.dashboard.search.getStarted}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid">
          {filteredServices.map((service) => (
            <div key={service.id} className="card">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '1rem',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{service.name}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`status-badge status-${service.status.toLowerCase()}`}>
                      {service.status}
                    </span>
                    <span
                      className={`text-[0.7rem] px-2 py-[0.1rem] rounded-[0.5rem] uppercase font-semibold border ${service.type === 'STATIC'
                          ? 'bg-sky-400/15 text-sky-400 border-sky-400/20'
                          : 'bg-purple-500/15 text-purple-500 border-purple-500/20'
                        }`}
                    >
                      {service.type || 'DOCKER'}
                    </span>
                    {service.customDomain && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {service.customDomain}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setEditingService(service)}
                    className="btn-icon"
                    title={t.dashboard.actions.edit}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
                    className="btn-icon"
                    style={{ color: 'var(--error)' }}
                    title={t.dashboard.actions.delete}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      background: 'var(--text-muted)',
                      borderRadius: '50%',
                    }}
                  ></div>
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {service.repoUrl}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-glass)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Cpu size={14} /> {t.dashboard.labels.cpu}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {service.metrics?.cpu || 0}%
                  </div>
                </div>
                <div
                  style={{
                    background: 'var(--bg-glass)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Zap size={14} /> {t.dashboard.labels.ram}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {service.metrics?.memory || 0} MB
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: 'auto',
                }}
              >
                {/* Primary action - full width */}
                <button
                  onClick={() => triggerDeploy(service.id)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  <Play size={16} /> {t.dashboard.actions.redeploy}
                </button>

                {/* Secondary actions - responsive grid */}
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}
                >
                  <button
                    onClick={() => restartService(service.id)}
                    className="btn btn-ghost"
                    title={t.dashboard.actions.restart}
                  >
                    <RotateCw size={16} />
                  </button>
                  <button
                    onClick={() => service.deployments[0] && fetchLogs(service.deployments[0].id)}
                    className="btn btn-ghost"
                    disabled={!service.deployments[0]}
                    title={t.dashboard.actions.logs}
                  >
                    <FileText size={16} />
                  </button>
                  <a
                    href={`http://${service.name}.localhost`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    title={t.dashboard.actions.visit}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Modal */}
      {selectedLogs !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '2rem',
          }}
        >
          <div
            ref={logsModalRef}
            tabIndex={-1}
            className="card glass active-logs focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-modal-title"
            style={{
              width: '100%',
              maxWidth: '900px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
            }}
          >
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileText size={20} className="text-primary" />
                <h2 id="logs-modal-title" style={{ fontSize: '1.25rem' }}>
                  {t.dashboard.modals.logsTitle}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedLogs(null);
                  setActiveDeploymentId(null);
                }}
                className="btn-icon"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: '#000' }}>
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: '#c9d1d9',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.5,
                }}
              >
                {selectedLogs}
              </pre>
            </div>
            <div
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border-light)',
                background: 'var(--bg-surface)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              {activeDeploymentId ? t.dashboard.modals.streaming : t.dashboard.modals.ended}
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '2rem',
          }}
        >
          <div
            ref={editModalRef}
            tabIndex={-1}
            className="card glass focus:outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-modal-title"
            style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div
              style={{
                marginBottom: '1.5rem',
                borderBottom: '1px solid var(--border-light)',
                paddingBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 id="edit-modal-title">{t.dashboard.modals.editTitle}</h2>
              <button onClick={() => setEditingService(null)} className="btn-icon">
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={updateService}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
            >
              <div>
                <label>{t.dashboard.labels.serviceName}</label>
                <input
                  type="text"
                  value={editingService.name}
                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label>{t.dashboard.labels.repoUrl}</label>
                <input
                  type="url"
                  value={editingService.repoUrl}
                  onChange={(e) =>
                    setEditingService({ ...editingService, repoUrl: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>{t.dashboard.labels.serviceType}</label>
                  <select
                    value={editingService.type || 'DOCKER'}
                    onChange={(e) =>
                      setEditingService({
                        ...editingService,
                        type: e.target.value,
                        port: e.target.value === 'STATIC' ? 80 : editingService.port,
                      })
                    }
                    className="w-full"
                  >
                    <option value="DOCKER">Docker Service</option>
                    <option value="STATIC">Static Site</option>
                  </select>
                </div>
                <div>
                  <label>Branch</label>
                  <input
                    type="text"
                    value={editingService.branch || ''}
                    onChange={(e) =>
                      setEditingService({ ...editingService, branch: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Port</label>
                  <input
                    type="number"
                    disabled={editingService.type === 'STATIC'}
                    value={editingService.type === 'STATIC' ? 80 : editingService.port || 3000}
                    onChange={(e) =>
                      setEditingService({ ...editingService, port: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label>Build Command</label>
                  <input
                    type="text"
                    value={editingService.buildCommand || ''}
                    onChange={(e) =>
                      setEditingService({ ...editingService, buildCommand: e.target.value })
                    }
                    placeholder="e.g. npm run build"
                  />
                </div>
                <div>
                  {editingService.type === 'STATIC' ? (
                    <>
                      <label>Output Directory</label>
                      <input
                        type="text"
                        value={editingService.staticOutputDir || ''}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            staticOutputDir: e.target.value,
                          })
                        }
                        placeholder="e.g. dist"
                      />
                    </>
                  ) : (
                    <>
                      <label>Start Command</label>
                      <input
                        type="text"
                        value={editingService.startCommand || ''}
                        onChange={(e) =>
                          setEditingService({
                            ...editingService,
                            startCommand: e.target.value,
                          })
                        }
                        placeholder="e.g. npm start"
                      />
                    </>
                  )}
                </div>
              </div>

              <div>
                <label>Environment Variables</label>
                <textarea
                  style={{ minHeight: '120px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  value={
                    editingService.envVars
                      ? Object.entries(editingService.envVars)
                        .map(([k, v]) => `${k}=${v}`)
                        .join('\n')
                      : ''
                  }
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    const envVars = Object.fromEntries(
                      lines
                        .filter((l) => l.trim() && l.includes('='))
                        .map((l) => {
                          const [k, ...v] = l.split('=');
                          return [k.trim(), v.join('=').trim()];
                        }),
                    );
                    setEditingService({ ...editingService, envVars });
                  }}
                  placeholder="DATABASE_URL=postgres://..."
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {t.dashboard.actions.save}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="btn btn-ghost"
                >
                  {t.dashboard.actions.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
