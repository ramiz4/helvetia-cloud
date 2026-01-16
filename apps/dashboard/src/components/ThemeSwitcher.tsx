'use client';

import { useTheme } from '@/lib/ThemeContext';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from 'shared-ui';

interface ThemeSwitcherProps {
  variant?: 'default' | 'minimal';
}

export default function ThemeSwitcher({ variant = 'default' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { t } = useLanguage();

  const themeOptions = [
    { value: 'light' as const, label: t.theme?.light || 'Light', icon: Sun },
    { value: 'dark' as const, label: t.theme?.dark || 'Dark', icon: Moon },
    { value: 'system' as const, label: t.theme?.system || 'System', icon: Monitor },
  ];

  const currentOption = themeOptions.find((opt) => opt.value === theme) || themeOptions[2];
  const Icon = currentOption.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      // Focus first option
      setTimeout(() => {
        const firstOption = dropdownRef.current?.querySelector('button');
        firstOption?.focus();
      }, 0);
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % themeOptions.length;
      const nextButton = dropdownRef.current?.querySelectorAll('button')[nextIndex];
      (nextButton as HTMLElement)?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = (index - 1 + themeOptions.length) % themeOptions.length;
      const prevButton = dropdownRef.current?.querySelectorAll('button')[prevIndex];
      (prevButton as HTMLElement)?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  if (variant === 'minimal') {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all"
          aria-label={t.theme?.switchTheme || 'Switch theme'}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <Icon size={18} aria-hidden="true" />
          <span className="text-sm font-medium">{currentOption.label}</span>
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            role="menu"
            className="absolute top-full mt-2 left-0 right-0 bg-slate-800/95 backdrop-blur-lg border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200"
          >
            {themeOptions.map((option, index) => {
              const OptionIcon = option.icon;
              const isSelected = option.value === theme;
              return (
                <button
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setIsOpen(false);
                    buttonRef.current?.focus();
                  }}
                  onKeyDown={(e) => handleOptionKeyDown(e, index)}
                  role="menuitem"
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <OptionIcon size={16} aria-hidden="true" />
                  <span className="text-sm font-medium">{option.label}</span>
                  {isSelected && (
                    <span className="ml-auto text-indigo-400" aria-label="Selected">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all"
        aria-label={t.theme?.switchTheme || 'Switch theme'}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={currentOption.label}
      >
        <Icon size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          className="absolute top-full mt-2 right-0 min-w-[160px] bg-slate-800/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200"
        >
          {themeOptions.map((option, index) => {
            const OptionIcon = option.icon;
            const isSelected = option.value === theme;
            return (
              <button
                key={option.value}
                onClick={() => {
                  setTheme(option.value);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                onKeyDown={(e) => handleOptionKeyDown(e, index)}
                role="menuitem"
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <OptionIcon size={16} aria-hidden="true" />
                <span className="text-sm font-medium">{option.label}</span>
                {isSelected && (
                  <span className="ml-auto text-indigo-400" aria-label="Selected">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
