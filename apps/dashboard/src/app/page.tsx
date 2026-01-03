'use client';

import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  repoUrl: string;
  status: string;
  deployments: { id: string; status: string; createdAt: string }[];
}

export default function Dashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main>
      <h1 style={{ marginBottom: '2rem' }}>Services</h1>

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
                <h3 style={{ fontSize: '1.2rem' }}>{service.name}</h3>
                <span className={`status-badge status-${service.status.toLowerCase()}`}>
                  {service.status}
                </span>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {service.repoUrl}
              </p>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button
                  onClick={() => triggerDeploy(service.id)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Redeploy
                </button>
                <a
                  href={`https://${service.name}.helvetia.cloud`}
                  target="_blank"
                  className="btn"
                  style={{ background: '#30363d', flex: 1, textAlign: 'center' }}
                >
                  Visit
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
