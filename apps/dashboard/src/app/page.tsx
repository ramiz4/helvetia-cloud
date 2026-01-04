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
  deployments: { id: string; status: string; createdAt: string }[];
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);

  const updateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      const res = await fetch(`http://localhost:3001/services/${editingService.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingService.name,
          repoUrl: editingService.repoUrl,
          branch: editingService.branch,
          buildCommand: editingService.buildCommand,
          startCommand: editingService.startCommand,
          port: editingService.port,
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
    fetch('http://localhost:3001/services')
      .then(res => res.json())
      .then(data => {
        setServices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const triggerDeploy = async (serviceId: string) => {
    try {
      await fetch(`http://localhost:3001/services/${serviceId}/deploy`, { method: 'POST' });
      // Refresh status
      const res = await fetch('http://localhost:3001/services');
      const data = await res.json();
      setServices(data);
    } catch (err) {
      alert('Failed to trigger deployment');
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This will stop the app and remove all data.')) return;

    try {
      const res = await fetch(`http://localhost:3001/services/${serviceId}`, { method: 'DELETE' });
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
    try {
      const res = await fetch(`http://localhost:3001/deployments/${deploymentId}/logs`);
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
        <button onClick={() => window.location.reload()} className="btn" style={{ background: '#30363d' }}>Refresh</button>
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
              <button onClick={() => setSelectedLogs(null)} className="btn" style={{ background: '#da3633' }}>Close</button>
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
