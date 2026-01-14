import { Sparkles } from 'lucide-react';
import React from 'react';

interface InputWithActionProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  onGenerate?: () => void;
  labelAction?: React.ReactNode;
}

export const InputWithAction: React.FC<InputWithActionProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  onGenerate,
  labelAction,
}) => (
  <div className="space-y-1.5 group">
    <div className="flex items-center justify-between">
      <label className="block text-sm font-medium text-slate-400 group-focus-within:text-blue-400 transition-colors">
        {label}
      </label>
      {labelAction}
    </div>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
        placeholder={placeholder}
      />
      {onGenerate && (
        <button
          onClick={onGenerate}
          type="button"
          title="Generate secure value"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 transition-all border border-blue-500/20 flex items-center gap-1.5"
        >
          <Sparkles size={14} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Auto</span>
        </button>
      )}
    </div>
  </div>
);
