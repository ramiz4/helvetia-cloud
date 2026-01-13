'use client';

import { ConfirmationModal } from '@/components/ConfirmationModal';
import { API_BASE_URL } from '@/lib/config';
import { fetchWithAuth } from '@/lib/tokenRefresh';
import { Role } from '@/types/organization';
import {
  CheckCircle2,
  Edit,
  Flag,
  Loader2,
  Plus,
  Power,
  Target,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  segments: {
    type?: 'userIds' | 'percentage';
    userIds?: string[];
    percentage?: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateFlagData {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  segments?: {
    type?: 'userIds' | 'percentage';
    userIds?: string[];
    percentage?: number;
  };
}

export default function FeatureFlagsAdminPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState<CreateFlagData>({
    key: '',
    name: '',
    description: '',
    enabled: false,
  });
  const [flagToDelete, setFlagToDelete] = useState<FeatureFlag | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === Role.ADMIN) {
          setIsAdmin(true);
        } else {
          window.location.href = '/';
        }
      } catch {
        window.location.href = '/login';
      }
    } else {
      window.location.href = '/login';
    }
  }, []);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags`);
      if (res.ok) {
        const data = await res.json();
        setFlags(data.data);
      } else if (res.status === 401) {
        window.location.href = '/login';
      } else {
        toast.error('Failed to load feature flags');
      }
    } catch (err) {
      console.error('Failed to fetch feature flags', err);
      toast.error('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Feature flag created successfully');
        setShowCreateModal(false);
        setFormData({ key: '', name: '', description: '', enabled: false });
        fetchFlags();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create feature flag');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create feature flag');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlag) return;

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags/${editingFlag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast.success('Feature flag updated successfully');
        setShowEditModal(false);
        setEditingFlag(null);
        setFormData({ key: '', name: '', description: '', enabled: false });
        fetchFlags();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update feature flag');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update feature flag');
    }
  };

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags/${flag.id}/toggle`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success(`Feature flag ${flag.enabled ? 'disabled' : 'enabled'}`);
        fetchFlags();
      } else {
        toast.error('Failed to toggle feature flag');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to toggle feature flag');
    }
  };

  const handleDelete = async () => {
    if (!flagToDelete) return;

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/feature-flags/${flagToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Feature flag deleted successfully');
        setFlagToDelete(null);
        fetchFlags();
      } else {
        toast.error('Failed to delete feature flag');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete feature flag');
    }
  };

  const openEditModal = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormData({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      enabled: flag.enabled,
      segments: flag.segments || undefined,
    });
    setShowEditModal(true);
  };

  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            <Flag className="text-indigo-500" size={40} />
            Feature Flags
          </h1>
          <p className="text-slate-400 text-lg">
            Control features without deployment. Enable A/B testing and gradual rollouts.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2"
        >
          <Plus size={20} />
          Create Flag
        </button>
      </div>

      {/* Flags List */}
      {flags.length === 0 ? (
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-12 rounded-[32px] text-center">
          <Flag className="mx-auto text-slate-600 mb-4" size={64} />
          <h3 className="text-2xl font-bold text-white mb-2">No feature flags yet</h3>
          <p className="text-slate-400 mb-6">Create your first feature flag to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 flex items-center gap-2 mx-auto"
          >
            <Plus size={20} />
            Create Flag
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-2xl hover:border-indigo-500/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{flag.name}</h3>
                    <code className="px-2 py-1 bg-slate-800/50 text-indigo-400 text-xs font-mono rounded border border-white/10">
                      {flag.key}
                    </code>
                    {flag.enabled ? (
                      <span className="text-[10px] uppercase tracking-widest bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 size={12} /> Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest bg-slate-500/15 text-slate-400 px-2.5 py-1 rounded-full border border-slate-500/20 flex items-center gap-1.5 font-bold">
                        <XCircle size={12} /> Disabled
                      </span>
                    )}
                  </div>
                  {flag.description && (
                    <p className="text-slate-400 text-sm mb-3">{flag.description}</p>
                  )}
                  {flag.segments && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Target size={14} />
                      {flag.segments.type === 'percentage' && (
                        <span>Rollout: {flag.segments.percentage}% of users</span>
                      )}
                      {flag.segments.type === 'userIds' && flag.segments.userIds && (
                        <span>
                          <Users size={14} className="inline mr-1" />
                          {flag.segments.userIds.length} specific users
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(flag)}
                    className={`p-2 rounded-lg transition-all ${
                      flag.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                        : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500 hover:text-white'
                    }`}
                    title={flag.enabled ? 'Disable flag' : 'Enable flag'}
                  >
                    <Power size={18} />
                  </button>
                  <button
                    onClick={() => openEditModal(flag)}
                    className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                    title="Edit flag"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => setFlagToDelete(flag)}
                    className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                    title="Delete flag"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Create Feature Flag</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ key: '', name: '', description: '', enabled: false });
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Key <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                  placeholder="feature_name"
                  pattern="[a-zA-Z0-9_-]+"
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-all font-mono"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use lowercase letters, numbers, underscores, and hyphens only
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Feature Name"
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this flag controls..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 rounded bg-slate-800/50 border border-white/10 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-bold text-white">Enable immediately</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Create Flag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ key: '', name: '', description: '', enabled: false });
                  }}
                  className="px-6 py-3 rounded-xl font-bold bg-slate-800/50 text-white hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingFlag && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Feature Flag</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFlag(null);
                  setFormData({ key: '', name: '', description: '', enabled: false });
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2">
                  Key (readonly)
                </label>
                <input
                  type="text"
                  value={formData.key}
                  disabled
                  className="w-full px-4 py-3 bg-slate-800/30 border border-white/5 rounded-lg text-slate-500 font-mono cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Feature Name"
                  required
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this flag controls..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-all resize-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-5 h-5 rounded bg-slate-800/50 border border-white/10 text-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-bold text-white">Enabled</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Update Flag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingFlag(null);
                    setFormData({ key: '', name: '', description: '', enabled: false });
                  }}
                  className="px-6 py-3 rounded-xl font-bold bg-slate-800/50 text-white hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {flagToDelete && (
        <ConfirmationModal
          title="Delete Feature Flag"
          message={`Are you sure you want to delete "${flagToDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setFlagToDelete(null)}
          isDanger
        />
      )}
    </div>
  );
}
