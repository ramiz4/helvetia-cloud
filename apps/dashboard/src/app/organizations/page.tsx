'use client';

import { useCreateOrganization, useOrganizations } from '@/hooks/useOrganizations';
import { Building2, Plus, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function OrganizationsPage() {
  const { data: organizations, isLoading } = useOrganizations();
  const createOrgMutation = useCreateOrganization();
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      await createOrgMutation.mutateAsync(newOrgName);
      toast.success('Organization created successfully');
      setNewOrgName('');
      setIsCreating(false);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : typeof error === 'string' && error
            ? error
            : 'Failed to create organization';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Organizations</h1>
            <p className="text-slate-400">Manage your teams and collaborate on projects</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg hover:-translate-y-0.5"
          >
            <Plus size={18} />
            <span>New Organization</span>
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="mb-6 bg-white/5 border border-white/10 rounded-2xl p-6 animate-in slide-in-from-top-4 duration-300">
          <h2 className="text-lg font-bold text-white mb-4">Create New Organization</h2>
          <form onSubmit={handleCreateOrg} className="flex gap-4">
            <div className="grow">
              <input
                type="text"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Organization name"
                className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={createOrgMutation.isPending || !newOrgName.trim()}
              className="px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              {createOrgMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewOrgName('');
              }}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations?.map((org) => (
          <div
            key={org.id}
            className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl hover:border-indigo-500/20 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{org.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
                </div>
              </div>
              <Link
                href={`/organizations/${org.id}/settings`}
                className="p-2 text-slate-500 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Settings size={18} />
              </Link>
            </div>

            <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
              <div className="flex items-center gap-1">
                <Users size={16} />
                <span>{org.members?.length || 0} members</span>
              </div>
            </div>

            <Link
              href={`/organizations/${org.id}/settings`}
              className="block w-full text-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-all"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>

      {organizations && organizations.length === 0 && !isCreating && (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900/50 border border-white/10 mb-4">
            <Building2 size={32} className="text-slate-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No organizations yet</h3>
          <p className="text-slate-400 mb-6">
            Create your first organization to start collaborating
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-lg hover:-translate-y-0.5"
          >
            <Plus size={18} />
            <span>Create Organization</span>
          </button>
        </div>
      )}
    </div>
  );
}
