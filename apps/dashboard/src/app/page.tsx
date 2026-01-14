'use client';

import { NewProjectModal } from '@/components/NewProjectModal';
import { ProjectCard } from '@/components/ProjectCard';
import { FolderPlus, Plus, Rocket } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from 'shared-ui';
import { ErrorBoundary } from '../components/ErrorBoundary';
import LandingPage from '../components/LandingPage';
import { useCreateProject, useDeleteProject, useProjects } from '../hooks/useProjects';
import { useLanguage } from 'shared-ui';
import { useOrganizationContext } from '../lib/OrganizationContext';
import { checkAndRefreshToken } from 'shared-ui';

export default function Home() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const { currentOrganization } = useOrganizationContext();

  // Project hooks
  const {
    data: projects = [],
    isLoading,
    isError,
    error,
  } = useProjects(currentOrganization?.id, { enabled: !!isAuthenticated && !!currentOrganization });

  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();

  // Check authentication and refresh token on page load
  useEffect(() => {
    const initAuth = async () => {
      const user = localStorage.getItem('user');
      if (user) {
        const refreshed = await checkAndRefreshToken();
        setIsAuthenticated(refreshed);
        if (!refreshed) {
          localStorage.removeItem('user');
        }
      } else {
        setIsAuthenticated(false);
      }
    };

    initAuth();
  }, []);

  const handleCreateProject = async (name: string) => {
    try {
      await createProjectMutation.mutateAsync({ name, organizationId: currentOrganization?.id });
      toast.success('Project created successfully');
      setShowNewProjectModal(false);
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      await deleteProjectMutation.mutateAsync(projectToDelete);
      toast.success('Project deleted successfully');
      setProjectToDelete(null);
    } catch {
      toast.error('Failed to delete project');
    }
  };

  // Handle error state from React Query
  useEffect(() => {
    if (isError && error instanceof Error && error.message === 'Unauthorized') {
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

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <ErrorBoundary>
      <div className="py-8 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16">
          <div className="space-y-2">
            <h1 className="text-5xl font-extrabold tracking-tight mb-2 bg-linear-to-r from-white to-white/60 bg-clip-text text-transparent">
              Projects
            </h1>
            <p className="text-slate-400 text-lg font-medium">
              Manage your cloud infrastructure environments and services.
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowNewProjectModal(true)}
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold bg-white text-indigo-950 hover:bg-slate-200 transition-all shadow-xl active:scale-95 gap-3"
            >
              <FolderPlus size={22} />
              New Project
            </button>
            <Link
              href="/new"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 gap-3"
            >
              <Rocket size={22} />
              Deploy Service
            </Link>
          </div>
        </div>

        <div className="relative mb-12">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Plus size={20} className="text-slate-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full h-16 pl-16 pr-8 bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-semibold transition-all shadow-2xl placeholder:text-slate-600 border-none"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="w-14 h-14 border-4 border-white/10 border-t-indigo-500 rounded-full animate-spin-fast" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm animate-pulse">
              {t.dashboard.loading}
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[48px] text-center p-24 flex flex-col items-center gap-10 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-linear-to-b from-indigo-500/10 to-transparent opacity-50 transition-opacity group-hover:opacity-100" />
            <div className="w-24 h-24 bg-slate-800/80 rounded-[32px] flex items-center justify-center relative z-10 ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-500 shadow-3xl">
              <FolderPlus
                size={48}
                className="text-slate-600 group-hover:text-indigo-400 transition-colors"
              />
            </div>
            <div className="relative z-10 max-w-lg">
              <h3 className="text-4xl font-black text-white mb-6">No projects found</h3>
              <p className="text-slate-400 text-xl mb-12 leading-relaxed font-medium">
                {searchQuery
                  ? 'No projects match your search query.'
                  : 'Projects help you organize your services, databases, and environments into logical groups.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowNewProjectModal(true)}
                  className="inline-flex items-center justify-center px-12 py-6 rounded-[24px] font-black text-xl bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:-translate-y-2 shadow-2xl shadow-indigo-500/40 active:scale-95 gap-4"
                >
                  <Plus size={28} />
                  Start First Project
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={() => setProjectToDelete(project.id)}
              />
            ))}
          </div>
        )}

        {showNewProjectModal && (
          <NewProjectModal
            onClose={() => setShowNewProjectModal(false)}
            onSave={handleCreateProject}
          />
        )}

        {projectToDelete && (
          <ConfirmationModal
            title="Delete Project"
            message="Are you sure you want to delete this project? All associated services and environments will be permanently removed. This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={handleDeleteProject}
            onCancel={() => setProjectToDelete(null)}
            isDanger
            isLoading={deleteProjectMutation.isPending}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
