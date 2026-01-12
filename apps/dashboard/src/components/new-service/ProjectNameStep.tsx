'use client';

import { useCreateProject, useProjects } from '@/hooks/useProjects';
import { useLanguage } from '@/lib/LanguageContext';
import { ChevronRight, Folder, Loader2, Plus, Settings } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ServiceFormData } from './types';

interface ProjectNameStepProps {
  data: ServiceFormData;
  updateData: (data: Partial<ServiceFormData>) => void;
  onNext: () => void;
}

export default function ProjectNameStep({ data, updateData, onNext }: ProjectNameStepProps) {
  const { t } = useLanguage();
  const { data: projects = [], isLoading } = useProjects();
  const createProjectMutation = useCreateProject();

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const selectedProject = projects.find((p) => p.id === data.projectId);
  const environments = selectedProject?.environments || [];

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProjectMutation.mutateAsync(newProjectName.trim());
      updateData({
        projectId: project.id,
        environmentId: project.environments?.[0]?.id || '',
      });
      setIsCreatingProject(false);
      setNewProjectName('');
      toast.success('Project created');
    } catch {
      toast.error('Failed to create project');
    }
  };

  const isStepValid = data.projectId && data.environmentId;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
          Loading Projects...
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
          <Settings className="text-indigo-400" size={24} />
          {t.dashboard.newService.step1}
        </h2>

        <div className="space-y-8 max-w-xl">
          {/* Project Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">
                Select Project
              </label>
              <button
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Plus size={14} />
                {isCreatingProject ? 'Cancel' : 'New Project'}
              </button>
            </div>

            {isCreatingProject ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="project-name"
                  className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-semibold transition-all"
                />
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjectName.trim() || createProjectMutation.isPending}
                  className="px-6 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-400 transition-all disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() =>
                      updateData({
                        projectId: project.id,
                        environmentId: project.environments?.[0]?.id || '',
                      })
                    }
                    className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${
                      data.projectId === project.id
                        ? 'bg-indigo-500/10 border-indigo-500 text-white'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <Folder
                      size={18}
                      className={
                        data.projectId === project.id ? 'text-indigo-400' : 'text-slate-600'
                      }
                    />
                    <span className="font-bold truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Environment Selection */}
          {data.projectId && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">
                Environment
              </label>
              <div className="flex flex-wrap gap-2">
                {environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => updateData({ environmentId: env.id })}
                    className={`px-6 py-3 rounded-xl border font-bold transition-all ${
                      data.environmentId === env.id
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {env.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Service Name input removed */}

          <button
            onClick={onNext}
            disabled={!isStepValid}
            className="w-full h-14 bg-white text-indigo-950 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-xl"
          >
            {t.common.next}
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
