'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { type Language } from '@/lib/translations';
import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export default function LanguageSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage } = useLanguage();
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

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        // Focus will be moved to first item via useEffect or manually here?
        // Let's do it in a useEffect that watches isOpen
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
        const first = buttons[0];
        (first as HTMLElement).focus();
      }
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      if (buttons) {
        const nextIndex = (index + 1) % buttons.length;
        buttons[nextIndex].focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      if (buttons) {
        const prevIndex = (index - 1 + buttons.length) % buttons.length;
        buttons[prevIndex].focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      buttons?.[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const buttons =
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
      buttons?.[buttons.length - 1]?.focus();
    }
  };

  // Focus first item when opening
  useEffect(() => {
    if (isOpen) {
      // Small timeout to allow render
      requestAnimationFrame(() => {
        const buttons =
          menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]');
        buttons?.[0]?.focus();
      });
    }
  }, [isOpen]);

  const currentLang = languages.find((l) => l.code === language);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-white/10 transition-colors"
        aria-label="Select Language"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="language-menu"
      >
        <Globe size={16} />
        <span className="text-sm font-medium uppercase min-w-[1.2rem]">
          {currentLang?.short || 'EN'}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          id="language-menu"
          ref={menuRef}
          role="menu"
          className="absolute right-0 mt-2 w-48 py-1 rounded-lg bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-xl animate-fade-in z-50 overflow-hidden"
        >
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
              className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-white/10 transition-colors focus:bg-white/10 focus:outline-none ${
                language === l.code ? 'bg-white/5 text-indigo-400' : 'text-slate-400'
              }`}
            >
              <span>{l.label}</span>
              <span className="text-xs opacity-50 uppercase">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
