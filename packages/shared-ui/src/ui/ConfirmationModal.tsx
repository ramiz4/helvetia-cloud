'use client';

import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useLanguage } from '../config/LanguageContext';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
  isLoading?: boolean;
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isDanger = false,
  isLoading = false,
}: ConfirmationModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDanger ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <p className="text-slate-400 font-medium leading-relaxed">{message}</p>

          <div className="flex gap-4 mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 h-12 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
            >
              {cancelLabel || t.common.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 h-12 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg ${
                isDanger
                  ? 'bg-red-500 text-white hover:bg-red-400 shadow-red-500/20'
                  : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.common.loading}
                </>
              ) : (
                confirmLabel || t.common.confirm
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
