'use client';

import FocusTrap from '@/components/FocusTrap';
import { FileText, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface LogsModalProps {
  logs: string;
  isStreaming: boolean;
  onClose: () => void;
  translations: {
    modals: {
      logsTitle: string;
      streaming: string;
      ended: string;
    };
  };
}

export function LogsModal({ logs, isStreaming, onClose, translations: t }: LogsModalProps) {
  const logsModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsModalRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-100 p-8">
      <FocusTrap active={true} onEscape={onClose}>
        <div
          ref={logsModalRef}
          className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-[32px] overflow-hidden focus:outline-none bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logs-modal-title"
        >
          <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-indigo-500 dark:text-indigo-400" />
              <h2 id="logs-modal-title" className="text-xl font-bold text-slate-900 dark:text-white">
                {t.modals.logsTitle}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
              aria-label="Close logs"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-black/40 custom-scrollbar">
            <pre className="font-mono text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap underline-offset-4 leading-relaxed">
              {logs}
            </pre>
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs font-medium text-slate-500 tracking-wider uppercase">
            {isStreaming ? t.modals.streaming : t.modals.ended}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
