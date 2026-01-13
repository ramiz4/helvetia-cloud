'use client';

import type { Service } from '@/types/service';
import {
  Check,
  Copy,
  Cpu,
  Edit2,
  FileText,
  Globe,
  Play,
  RotateCw,
  Square,
  Trash2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

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
      containerName: string;
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (service.containerName) {
      navigator.clipboard.writeText(service.containerName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const serviceUrl =
    service.projectName && service.environmentName
      ? `http://${service.username}.${service.projectName}.${service.environmentName}.${service.name}.localhost`
      : `http://${service.name}.localhost`;

  return (
    <div className="group relative p-8 rounded-[40px] bg-slate-900/40 backdrop-blur-3xl border border-white/10 hover:border-indigo-500/30 transition-all duration-700 shadow-2xl hover:shadow-indigo-500/10 flex flex-col h-full overflow-hidden">
      <div className="absolute top-0 right-0 p-8 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
        <button
          onClick={() => onEdit(service)}
          className="p-3 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/10 active:scale-90"
          title={t.actions.edit}
        >
          <Edit2 size={18} />
        </button>
        <button
          onClick={() => onDelete(service.id)}
          className="p-3 rounded-2xl bg-white/5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-white/10 active:scale-90"
          title={t.actions.delete}
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <h3 className="text-3xl font-black text-white tracking-tighter mb-4 leading-none">
              {service.name}
            </h3>
            <div className="flex items-center gap-3">
              <span
                className={`text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${
                  service.status === 'RUNNING'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-slate-500'
                }`}
              >
                {service.status || t.status.notRunning}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                {service.type === 'STATIC'
                  ? t.newService.staticSite
                  : service.type === 'DOCKER'
                    ? t.newService.dockerService
                    : t.newService.composeStack}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {service.containerName && (
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 text-[10px] text-slate-500 hover:text-indigo-300 transition-all bg-white/5 hover:bg-indigo-500/10 px-2 py-1 rounded-md w-fit font-mono border border-white/5 hover:border-indigo-500/20 group/copy relative"
                title="Click to copy container name"
              >
                <span className="font-bold uppercase tracking-wider text-[9px] text-slate-600 group-hover/copy:text-indigo-400/70 transition-colors">
                  {t.labels.containerName}:
                </span>
                <span className="text-indigo-400/70 select-all font-medium">
                  {service.containerName}
                </span>
                <div className="ml-1 text-slate-600 group-hover/copy:text-indigo-400 transition-colors">
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                </div>
                {copied && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300 shadow-xl">
                    Copied!
                  </div>
                )}
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm text-indigo-400/80 hover:text-indigo-400 transition-colors">
            <Globe size={12} />
            <a
              href={serviceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium hover:underline"
            >
              {serviceUrl.replace('http://', '').replace('https://', '').toLocaleLowerCase()}
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-indigo-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-indigo-400 transition-colors">
            <Cpu size={14} className="opacity-70" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{t.labels.cpu}</span>
          </div>
          <div className="text-xl font-bold text-white tabular-nums tracking-tight">
            {service.metrics?.cpu || 0}
            <span className="text-sm font-medium text-slate-500 ml-1">%</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 group/metric hover:border-amber-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-3 text-slate-500 group-hover/metric:text-amber-400 transition-colors">
            <Zap size={14} className="opacity-70" />
            <span className="text-[11px] font-bold uppercase tracking-widest">{t.labels.ram}</span>
          </div>
          <div className="text-xl font-bold text-white tabular-nums tracking-tight">
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
