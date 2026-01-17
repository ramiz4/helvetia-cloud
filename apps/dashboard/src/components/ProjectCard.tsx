'use client';

import type { Project } from '@/types/project';
import { Box, ChevronRight, Folder, Layout, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface ProjectCardProps {
  project: Project;
  onDelete: (projectId: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const serviceCount =
    project.environments?.reduce((acc, env) => acc + (env.services?.length || 0), 0) || 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="p-8 rounded-[32px] bg-white dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 transition-all duration-500 group shadow-xl dark:shadow-2xl flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete(project.id);
          }}
          className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-lg"
          title="Delete Project"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 dark:text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
          <Folder size={28} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
            {project.name}
          </h3>
          <p className="text-slate-500 text-sm mt-2 font-medium">Project</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group-hover:bg-slate-100 dark:group-hover:bg-white/[0.07] transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Layout size={14} className="opacity-70" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Environments
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
            {project.environments?.length || 0}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 group-hover:bg-slate-100 dark:group-hover:bg-white/[0.07] transition-colors">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Box size={14} className="opacity-70" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Services
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
            {serviceCount}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
        <span className="text-slate-500 text-xs font-medium uppercase tracking-widest">
          View Project
        </span>
        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:translate-x-2 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500 shadow-lg">
          <ChevronRight size={20} />
        </div>
      </div>
    </Link>
  );
}
