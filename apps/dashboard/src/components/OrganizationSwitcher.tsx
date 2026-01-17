'use client';

import { useOrganizations } from '@/hooks/useOrganizations';
import { useOrganizationContext } from '@/lib/OrganizationContext';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function OrganizationSwitcher() {
  const { currentOrganization, setCurrentOrganization } = useOrganizationContext();
  const { data: organizations } = useOrganizations();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentOrganization) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95"
      >
        <Building2 size={16} className="text-indigo-500 dark:text-indigo-400" />
        <span className="text-[14px] font-medium max-w-[120px] truncate">
          {currentOrganization.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl backdrop-blur-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
          <div className="px-3 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
            Organizations
          </div>

          <div className="max-h-60 overflow-y-auto mt-1">
            {organizations?.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  setCurrentOrganization(org);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-[14px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2
                    size={14}
                    className={
                      org.id === currentOrganization.id
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }
                  />
                  <span className="truncate">{org.name}</span>
                </div>
                {org.id === currentOrganization.id && (
                  <Check size={14} className="text-indigo-600 dark:text-indigo-400" />
                )}
              </button>
            ))}
          </div>

          <div className="h-px bg-slate-100 dark:bg-white/5 my-2" />

          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-[14px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-400/10 transition-colors font-medium"
            onClick={() => {
              // TODO: Open Create Organization Modal
              setIsOpen(false);
            }}
          >
            <Plus size={14} />
            <span>New Organization</span>
          </button>
        </div>
      )}
    </div>
  );
}
