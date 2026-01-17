'use client';

import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../config/LanguageContext';
import { type Language } from '../config/translations';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'minimal';
}

export default function LanguageSwitcher({ variant = 'dropdown' }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string; short: string }[] = [
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'de', label: 'Deutsch', short: 'DE' },
    { code: 'gsw', label: 'Schwiizerdütsch', short: 'CH' },
    { code: 'fr', label: 'Français', short: 'FR' },
    { code: 'it', label: 'Italiano', short: 'IT' },
  ];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      if (buttons) {
        (buttons[0] as HTMLElement).focus();
      }
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
    if (!buttons) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % buttons.length;
      buttons[nextIndex].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + buttons.length) % buttons.length;
      buttons[prevIndex].focus();
    }
  };

  // Focus first item when opening
  useEffect(() => {
    if (isOpen && variant === 'dropdown') {
      // Small timeout to allow render
      requestAnimationFrame(() => {
        const buttons =
          menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
        buttons?.[0]?.focus();
      });
    }
  }, [isOpen, variant]);

  const currentLang = languages.find((l) => l.code === language);

  if (variant === 'minimal') {
    return (
      <div className="flex flex-wrap gap-2">
        {languages.map((l) => (
          <button
            key={l.code}
            onClick={() => setLanguage(l.code as Language)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${language === l.code
              ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-white/10'
              }`}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        #language-menu::-webkit-scrollbar { width: 4px; }
        #language-menu::-webkit-scrollbar-track { background: transparent; }
        #language-menu::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
        #language-menu::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.5); }
        .dark #language-menu::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
        .dark #language-menu::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `,
        }}
      />

      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 group text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
        aria-label={t.nav.selectLanguage}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="language-menu"
      >
        <Globe
          size={16}
          className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors"
        />
        <span className="text-sm font-bold uppercase min-w-[1.2rem] text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {currentLang?.short || 'EN'}
        </span>
        <ChevronDown
          className={`text-slate-500 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id="language-menu"
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-48 py-2 rounded-2xl bg-white dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-50 overflow-y-auto max-h-[300px] ring-1 ring-black/5 dark:ring-white/5"
        >
          <div className="px-3 pb-2 mb-1 border-b border-slate-100 dark:border-white/5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400">
              {t.nav.selectLanguage}
            </span>
          </div>
          {languages.map((l, index) => (
            <button
              key={l.code}
              role="menuitem"
              onClick={() => {
                setLanguage(l.code as Language);
                setIsOpen(false);
                buttonRef.current?.focus();
              }}
              onKeyDown={(e) => handleMenuKeyDown(e, index)}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-all focus:bg-slate-100 dark:focus:bg-white/10 focus:outline-none group/item ${language === l.code
                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/5'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span className="font-medium">{l.label}</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 ${language === l.code
                  ? 'text-indigo-600 dark:text-indigo-500 bg-indigo-100 dark:bg-indigo-500/10'
                  : 'text-slate-500'
                  }`}
              >
                {l.short}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
