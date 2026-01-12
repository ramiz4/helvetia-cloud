'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { ChevronDown, CreditCard, HelpCircle, LogOut, Settings, Shield, User } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface UserMenuProps {
  user: {
    username: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/10 group"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`${user.username} user menu`}
      >
        <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-indigo-500/20 border border-indigo-500/30">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.username}
              fill
              sizes="32px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-indigo-400">
              <User size={16} />
            </div>
          )}
        </div>
        <div className="hidden md:block text-left mr-1">
          <div className="text-sm font-semibold leading-none group-hover:text-white transition-colors">
            {user.username}
          </div>
          <div className="text-[10px] text-white/40 mt-1 uppercase tracking-wider font-bold flex items-center gap-1">
            {t.common.freePlan}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+10px)] right-0 min-w-[220px] bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 z-100 animate-in fade-in zoom-in-95 duration-200 origin-top-right"
          role="menu"
          aria-label="User menu"
        >
          <div className="px-3 py-3 border-b border-white/10 mb-1.5">
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-white">{user.username}</span>
              <span className="text-[11px] text-slate-400 tracking-tight">
                {t.common.personalAccount}
              </span>
            </div>
          </div>

          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 text-[13px] font-medium transition-all group/item"
            role="menuitem"
          >
            <Settings
              size={16}
              className="text-slate-400 group-hover/item:text-indigo-400 transition-colors"
            />
            <span>{t.nav.settings}</span>
          </Link>

          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 text-[13px] font-medium w-full text-left cursor-not-allowed group/item"
            disabled
            aria-disabled="true"
            role="menuitem"
          >
            <CreditCard size={16} />
            <span>{t.userMenu.billing}</span>
            <span className="ml-auto text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 bg-white/5 rounded">
              {t.userMenu.pro}
            </span>
          </button>

          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 text-[13px] font-medium w-full text-left cursor-not-allowed group/item"
            disabled
            aria-disabled="true"
            role="menuitem"
          >
            <Shield size={16} />
            <span>{t.userMenu.security}</span>
          </button>

          <div className="h-px bg-white/10 my-1.5 mx-1" role="separator"></div>

          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 text-[13px] font-medium w-full text-left cursor-not-allowed group/item"
            disabled
            aria-disabled="true"
            role="menuitem"
          >
            <HelpCircle size={16} />
            <span>{t.userMenu.support}</span>
          </button>

          <div className="h-px bg-white/10 my-1.5 mx-1" role="separator"></div>

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[13px] font-medium w-full text-left transition-all"
            role="menuitem"
          >
            <LogOut size={16} />
            <span>{t.nav.logout}</span>
          </button>
        </div>
      )}
    </div>
  );
}
