'use client';

import type { Service } from '@/types/service';
import { Cpu, Edit2, FileText, Globe, Play, RotateCw, Square, Trash2, Zap } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (serviceId: string) => void;
  onDeploy: (serviceId: string) => void;
  onRestart: (serviceId: string) => void;
  onStop: (serviceId: string) => void;
  onViewLogs: (deploymentId: string) => void;
  translations: {
    status: {
      notRunning: string;
    };
    newService: {
      staticSite: string;
      dockerService: string;
      composeStack: string;
    };
    actions: {
      edit: string;
      delete: string;
      restart: string;
      redeploy: string;
      logs: string;
      visit: string;
    };
    labels: {
      cpu: string;
      ram: string;
    };
  };
}

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onDeploy,
  onRestart,
  onStop,
  onViewLogs,
  translations: t,
}: ServiceCardProps) {
  const serviceUrl = `http://${service.projectName ? `${service.projectName}-${service.name}` : service.name}.localhost`;

  return (
    <div className="p-8 rounded-[32px] bg-slate-900/40 backdrop-blur-xl border border-white/10 hover:border-indigo-500/30 transition-all duration-500 group shadow-2xl flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-3">
          <h3 className="text-2xl font-bold text-white tracking-tight leading-none">
            {service.name}
          </h3>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                service.status === 'RUNNING'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                  : service.status === 'DEPLOYING'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20 animate-pulse'
                    : service.status === 'FAILED'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/20'
                      : 'bg-slate-500/15 text-slate-400 border-slate-500/20'
              }`}
            >
              {service.status === 'NOT_RUNNING' ? t.status.notRunning : service.status}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                service.type === 'STATIC'
                  ? 'bg-sky-500/15 text-sky-400 border-sky-500/20'
                  : 'bg-purple-500/15 text-purple-400 border-purple-500/20'
              }`}
            >
              {service.type === 'STATIC'
                ? t.newService.staticSite
                : service.type === 'COMPOSE'
                  ? t.newService.composeStack
                  : t.newService.dockerService}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(service)}
            className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label={`${t.actions.edit} ${service.name}`}
            title={t.actions.edit}
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => onDelete(service.id)}
            className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
            aria-label={`${t.actions.delete} ${service.name}`}
            title={t.actions.delete}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-8 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="w-2 h-2 rounded-full bg-slate-600 shadow-[0_0_8px_rgba(71,85,105,0.5)]" />
          <span className="truncate font-medium">{service.repoUrl}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-indigo-400/80 hover:text-indigo-400 transition-colors">
          <Globe size={12} />
          <a
            href={serviceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium hover:underline"
          >
            {serviceUrl.replace('http://', '')}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-indigo-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-indigo-400 transition-colors">
            <Cpu size={14} className="opacity-70" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{t.labels.cpu}</span>
          </div>
          <div className="text-2xl font-bold text-white tabular-nums tracking-tight">
            {service.metrics?.cpu || 0}
            <span className="text-sm font-medium text-slate-500 ml-1">%</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-amber-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-amber-400 transition-colors">
            <Zap size={14} className="opacity-70" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{t.labels.ram}</span>
          </div>
          <div className="text-2xl font-bold text-white tabular-nums tracking-tight">
            {service.metrics?.memory || 0}
            <span className="text-sm font-medium text-slate-500 ml-1">MB</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-auto">
        <button
          onClick={() => onDeploy(service.id)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all hover:shadow-[0_8px_20px_rgba(99,102,241,0.3)] shadow-lg active:scale-95"
        >
          <Play size={18} fill="currentColor" /> {t.actions.redeploy}
        </button>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onRestart(service.id)}
            className="flex items-center justify-center py-3.5 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm active:scale-95 group/btn"
            aria-label={`${t.actions.restart} ${service.name}`}
            title={t.actions.restart}
          >
            <RotateCw
              size={18}
              className="group-active/btn:rotate-180 transition-transform duration-500"
            />
          </button>
          <button
            onClick={() => service.deployments?.[0] && onViewLogs(service.deployments[0].id)}
            className="flex items-center justify-center py-3.5 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5 shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed group/btn"
            disabled={!service.deployments?.[0]}
            aria-label={`${t.actions.logs} for ${service.name}`}
            title={t.actions.logs}
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => onStop(service.id)}
            className="flex items-center justify-center py-3.5 rounded-2xl bg-rose-500/10 text-rose-400 hover:text-white hover:bg-rose-500 transition-all border border-rose-500/10 shadow-sm active:scale-95 group/btn"
            aria-label="Stop service"
            title="Stop service"
          >
            <Square size={18} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
