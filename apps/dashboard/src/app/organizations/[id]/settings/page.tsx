'use client';

import MemberManagement from '@/components/organizations/MemberManagement';
import { useOrganization } from '@/hooks/useOrganizations';
import { Building2, Layout, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

export default function OrganizationSettingsPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: organization, isLoading } = useOrganization(id);
  const [activeTab, setActiveTab] = useState<'general' | 'members'>('general');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-white">Organization not found</h1>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
            <Building2 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {organization.name} Settings
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your organization members and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <aside className="w-full md:w-64 shrink-0">
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all ${
                activeTab === 'general'
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'
              }`}
            >
              <Layout size={18} />
              <span>General</span>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all ${
                activeTab === 'members'
                  ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent'
              }`}
            >
              <Users size={18} />
              <span>Members</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="grow space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          {activeTab === 'general' && (
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-xl dark:shadow-2xl">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                General Information
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    defaultValue={organization.name}
                    readOnly
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-500 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all opacity-70 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                    Organization Slug
                  </label>
                  <input
                    type="text"
                    defaultValue={organization.slug}
                    readOnly
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-500 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all opacity-70 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && <MemberManagement organization={organization} />}
        </main>
      </div>
    </div>
  );
}
