'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { Loader2, Settings, X } from 'lucide-react';
import { useState } from 'react';

interface NewProjectModalProps {
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export function NewProjectModal({ onClose, onSave }: NewProjectModalProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSave(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="p-8 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Settings size={20} />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Create New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest">
              Project Name
            </label>
            <input
              autoFocus
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-awesome-app"
              className="w-full h-14 px-6 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white font-semibold transition-all placeholder:text-slate-600"
            />
            <p className="text-[11px] text-slate-500 font-medium">
              {t.dashboard.newService.projectNameHint}
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-14 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all active:scale-95 border border-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 h-14 bg-indigo-500 text-white font-bold rounded-2xl hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
