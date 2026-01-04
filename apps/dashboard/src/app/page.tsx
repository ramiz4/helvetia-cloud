'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  status: string;
  envVars?: Record<string, string>;
  customDomain?: string;
  metrics?: { cpu: number; memory: number; memoryLimit: number };
  deployments: { id: string; status: string; createdAt: string }[];
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [activeDeploymentId, setActiveDeploymentId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeDeploymentId) return;

    const socket = new WebSocket(`ws://localhost:3001/deployments/${activeDeploymentId}/logs/stream`);

    socket.onopen = () => console.log('WebSocket connected');
    socket.onmessage = (event) => {
      setSelectedLogs(prev => (prev === 'No logs available.' ? '' : (prev || '')) + event.data);
    };
    socket.onerror = (error) => console.error('WebSocket error:', error);
    socket.onclose = () => console.log('WebSocket disconnected');

    return () => socket.close();
  }, [activeDeploymentId]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
    }
  }, []);

  const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const updateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      const res = await fetch(`http://localhost:3001/services/${editingService.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          name: editingService.name,
          repoUrl: editingService.repoUrl,
          branch: editingService.branch,
          buildCommand: editingService.buildCommand,
          startCommand: editingService.startCommand,
          port: editingService.port,
          envVars: editingService.envVars,
          customDomain: editingService.customDomain,
        }),
      });

      if (res.ok) {
        setServices(services.map(s => s.id === editingService.id ? { ...s, ...editingService } : s));
        setEditingService(null);
      } else {
        alert('Failed to update service');
      }
    } catch (err) {
      alert('Error connecting to API');
    }
  };

  useEffect(() => {
    const fetchServices = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      fetch('http://localhost:3001/services', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServices(data);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    };

    fetchServices();
    const interval = setInterval(fetchServices, 10000); // Poll for service updates every 10s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (services.length === 0) return;

    const fetchMetrics = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const updatedServices = await Promise.all(services.map(async (service) => {
        try {
          const res = await fetch(`http://localhost:3001/services/${service.id}/metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const metrics = await res.json();
          return { ...service, metrics };
        } catch (err) {
          return service;
        }
      }));
      setServices(updatedServices);
    };

    const interval = setInterval(fetchMetrics, 5000); // Poll metrics every 5s
    return () => clearInterval(interval);
  }, [services.length]); // Re-run if service count changes

  const triggerDeploy = async (serviceId: string) => {
    try {
      const res = await fetch(`http://localhost:3001/services/${serviceId}/deploy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const deployment = await res.json();

      // Open logs immediately for the new deployment
      fetchLogs(deployment.id);

      // Refresh status
      const servicesRes = await fetch('http://localhost:3001/services', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await servicesRes.json();
      if (Array.isArray(data)) setServices(data);
    } catch (err) {
      alert('Failed to trigger deployment');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This will stop the app and remove all data.')) return;

    try {
      const res = await fetch(`http://localhost:3001/services/${serviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setServices(services.filter(s => s.id !== serviceId));
      } else {
        alert('Failed to delete service');
      }
    } catch (err) {
      alert('Error connecting to API');
    }
  };

  const fetchLogs = async (deploymentId: string) => {
    setActiveDeploymentId(deploymentId);
    try {
      const res = await fetch(`http://localhost:3001/deployments/${deploymentId}/logs`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setSelectedLogs(data.logs || 'No logs available.');
    } catch (err) {
      alert('Failed to fetch logs');
    }
  };

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Services</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => window.location.reload()} className="btn" style={{ background: '#30363d' }}>Refresh</button>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            className="btn"
            style={{ background: '#da3633' }}
          >
            Logout
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner"></div>
        </div>
      ) : services.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>No services yet.</p>
          <a href="/new" className="btn btn-primary">Connect your first repository</a>
        </div>
      ) : (
        <div className="grid">
          {services.map(service => (
            <div key={service.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem' }}>{service.name}</h3>
                  <span className={`status-badge status-${service.status.toLowerCase()}`} style={{ marginTop: '0.5rem', display: 'inline-block' }}>
                    {service.status}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setEditingService(service)}
                    className="btn"
                    style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '0.4rem', border: '1px solid var(--border-color)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteService(service.id)}
                    className="btn"
                    style={{ background: 'transparent', color: '#da3633', padding: '0.4rem', border: '1px solid #da3633' }}
                    title="Delete Service"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {service.repoUrl}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '0.8rem' }}>
                  <button
                    onClick={() => triggerDeploy(service.id)}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    Redeploy
                  </button>
                  <button
                    onClick={() => service.deployments[0] && fetchLogs(service.deployments[0].id)}
                    className="btn"
                    style={{ background: '#30363d', flex: 1 }}
                    disabled={!service.deployments[0]}
                  >
                    View Logs
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '1rem', background: '#0d1117', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>CPU</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{service.metrics?.cpu || 0}%</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>RAM</div>
                    <div style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{service.metrics?.memory || 0} MB</div>
                  </div>
                </div>

                <a
                  href={`http://${service.name}.localhost`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ background: '#30363d', textAlign: 'center' }}
                >
                  Visit App
                </a>
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Recent Deployments
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {service.deployments.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No deployments yet.</p>
                  ) : (
                    service.deployments.slice(0, 5).map(dep => (
                      <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`status-badge status-${dep.status.toLowerCase()}`} style={{ width: '8px', height: '8px', borderRadius: '50%', padding: 0 }}></span>
                          <span style={{ color: 'var(--text-main)' }}>{new Date(dep.createdAt).toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => fetchLogs(dep.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                          Logs
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLogs !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2>Deployment Logs</h2>
              <button onClick={() => { setSelectedLogs(null); setActiveDeploymentId(null); }} className="btn" style={{ background: '#da3633' }}>Close</button>
            </div>
            <pre style={{ background: '#0d1117', padding: '1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#8b949e', whiteSpace: 'pre-wrap' }}>
              {selectedLogs}
            </pre>
          </div>
        </div>
      )}

      {editingService !== null && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '2rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2>Edit Service</h2>
              <button onClick={() => setEditingService(null)} className="btn" style={{ background: '#30363d' }}>Cancel</button>
            </div>

            <form onSubmit={updateService} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div className="form-group">
                <label>Service Name</label>
                <input
                  type="text"
                  value={editingService.name}
                  onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Repository URL</label>
                <input
                  type="url"
                  value={editingService.repoUrl}
                  onChange={e => setEditingService({ ...editingService, repoUrl: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Branch</label>
                <input
                  type="text"
                  value={editingService.branch || ''}
                  onChange={e => setEditingService({ ...editingService, branch: e.target.value })}
                />
              </div>

              <div className="grid" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label>Build Command</label>
                  <input
                    type="text"
                    value={editingService.buildCommand || ''}
                    onChange={e => setEditingService({ ...editingService, buildCommand: e.target.value })}
                    placeholder="e.g. npm run build"
                  />
                </div>
                <div className="form-group">
                  <label>Start Command</label>
                  <input
                    type="text"
                    value={editingService.startCommand || ''}
                    onChange={e => setEditingService({ ...editingService, startCommand: e.target.value })}
                    placeholder="e.g. npm start"
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    value={editingService.port || 3000}
                    onChange={e => setEditingService({ ...editingService, port: parseInt(e.target.value) })}
                    placeholder="3000"
                  />
                </div>
                <div className="form-group">
                  <label>Custom Domain (optional)</label>
                  <input
                    type="text"
                    value={editingService.customDomain || ''}
                    onChange={e => setEditingService({ ...editingService, customDomain: e.target.value })}
                    placeholder="app.example.com"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Environment Variables (KEY=VALUE, one per line)</label>
                <textarea
                  style={{ width: '100%', minHeight: '120px', background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.8rem', fontFamily: 'monospace' }}
                  value={Object.entries((editingService as any).envVars || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    const envVars = Object.fromEntries(lines.filter(l => l.includes('=')).map(l => {
                      const [k, ...v] = l.split('=');
                      return [k.trim(), v.join('=').trim()];
                    }));
                    setEditingService({ ...editingService, envVars } as any);
                  }}
                  placeholder="DATABASE_URL=postgres://..."
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
