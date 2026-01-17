'use client';

import { useTheme } from '@/lib/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ModernThemeSwitchProps {
  variant?: 'default' | 'minimal';
}

export default function ModernThemeSwitch({ variant = 'default' }: ModernThemeSwitchProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-16 h-8 rounded-full bg-white/5 border border-white/10 animate-pulse" />
    );
  }

  // Determine if we should show as "dark" - either explicitly dark or system preference is dark
  const isDark = resolvedTheme === 'dark';

  const handleToggle = () => {
    // Cycle through: light -> dark -> light
    // If currently on system, switch based on resolved theme
    if (theme === 'system') {
      setTheme(isDark ? 'light' : 'dark');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleToggle}
        className="group relative flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all w-full"
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
        aria-pressed={isDark}
      >
        {/* iOS-style toggle switch */}
        <div
          className={`
            relative w-14 h-8 rounded-full transition-all duration-300 ease-in-out
            ${
              isDark
                ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-indigo-400/30'
                : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/30'
            }
            border backdrop-blur-xl shadow-inner
          `}
        >
          {/* Glassmorphic thumb */}
          <div
            className={`
              absolute top-0.5 ${isDark ? 'left-[26px]' : 'left-0.5'}
              w-7 h-7 rounded-full
              bg-white/90 dark:bg-slate-800/90
              backdrop-blur-xl
              shadow-lg
              flex items-center justify-center
              transition-all duration-300 ease-out
              border border-white/20
            `}
            style={{
              boxShadow: isDark
                ? '0 2px 8px rgba(99, 102, 241, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
                : '0 2px 8px rgba(245, 158, 11, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
            }}
          >
            {isDark ? (
              <Moon size={14} className="text-indigo-400" aria-hidden="true" />
            ) : (
              <Sun size={14} className="text-amber-500" aria-hidden="true" />
            )}
          </div>

          {/* Background icons (subtle) */}
          <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
            <Sun
              size={12}
              className={`transition-opacity duration-300 ${isDark ? 'opacity-30' : 'opacity-0'} text-amber-400`}
              aria-hidden="true"
            />
            <Moon
              size={12}
              className={`transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-30'} text-indigo-400`}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">
            {isDark ? 'Dark Mode' : 'Light Mode'}
            {theme === 'system' && <span className="text-xs text-slate-400 ml-1">(Auto)</span>}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`
        relative w-16 h-8 rounded-full transition-all duration-300 ease-in-out
        ${
          isDark
            ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-indigo-400/30'
            : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/30'
        }
        border backdrop-blur-xl shadow-inner
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
        ${isDark ? 'focus:ring-indigo-400/50' : 'focus:ring-amber-400/50'}
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-pressed={isDark}
      title={`${isDark ? 'Dark' : 'Light'} mode${theme === 'system' ? ' (Auto)' : ''}`}
    >
      {/* Glassmorphic thumb */}
      <div
        className={`
          absolute top-0.5 ${isDark ? 'left-[32px]' : 'left-0.5'}
          w-7 h-7 rounded-full
          bg-white/90 dark:bg-slate-800/90
          backdrop-blur-xl
          shadow-lg
          flex items-center justify-center
          transition-all duration-300 ease-out
          border border-white/20
        `}
        style={{
          boxShadow: isDark
            ? '0 2px 8px rgba(99, 102, 241, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)'
            : '0 2px 8px rgba(245, 158, 11, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
        }}
      >
        {isDark ? (
          <Moon size={14} className="text-indigo-400" aria-hidden="true" />
        ) : (
          <Sun size={14} className="text-amber-500" aria-hidden="true" />
        )}
      </div>

      {/* Background icons (subtle) */}
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <Sun
          size={12}
          className={`transition-opacity duration-300 ${isDark ? 'opacity-30' : 'opacity-0'} text-amber-400`}
          aria-hidden="true"
        />
        <Moon
          size={12}
          className={`transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-30'} text-indigo-400`}
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
