'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewService() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    repoUrl: '',
    branch: 'main',
    buildCommand: 'npm install && npm run build',
    startCommand: 'npm run start',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Mock userId for MVP
      const res = await fetch('http://localhost:3001/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, userId: 'mock-user-id' }),
      });

      if (res.ok) {
        const service = await res.json();
        // Trigger initial deploy
        await fetch(`http://localhost:3001/services/${service.id}/deploy`, { method: 'POST' });
        router.push('/');
      } else {
        alert('Failed to create service');
      }
    } catch (err) {
      alert('Error connecting to API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>Connect a Repository</h1>

      <form onSubmit={handleSubmit} className="card">
        <label>Service Name</label>
        <input
          type="text"
          placeholder="my-awesome-app"
          required
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />

        <label>GitHub Repository URL</label>
        <input
          type="text"
          placeholder="https://github.com/user/repo"
          required
          value={formData.repoUrl}
          onChange={e => setFormData({ ...formData, repoUrl: e.target.value })}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label>Branch</label>
            <input
              type="text"
              value={formData.branch}
              onChange={e => setFormData({ ...formData, branch: e.target.value })}
            />
          </div>
        </div>

        <label>Build Command</label>
        <input
          type="text"
          value={formData.buildCommand}
          onChange={e => setFormData({ ...formData, buildCommand: e.target.value })}
        />

        <label>Start Command</label>
        <input
          type="text"
          value={formData.startCommand}
          onChange={e => setFormData({ ...formData, startCommand: e.target.value })}
        />

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem' }}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Deploy Service'}
        </button>
      </form>
    </main>
  );
}
