'use client';

import { useEffect, useState } from 'react';

interface CookieBannerProps {
  title: string;
  text: string;
  acceptText: string;
}

export default function CookieBanner({ title, text, acceptText }: CookieBannerProps) {
  const [accepted, setAccepted] = useState(true); // Default to true to avoid flash, check useEffect

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const consent = window.localStorage.getItem('cookie_consent');
    if (!consent) {
      setAccepted(false);
    }
  }, []);

  const handleAcceptCookies = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cookie_consent', 'true');
    }
    setAccepted(true);
  };

  if (accepted) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in">
      <div className="container max-w-4xl mx-auto">
        <div className="glass p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-indigo-500/20 shadow-glow">
          <div className="text-sm md:text-base text-(--text-primary)">
            <span className="font-semibold block mb-1">{title}</span>
            {text}
          </div>
          <button
            onClick={handleAcceptCookies}
            className="btn btn-primary whitespace-nowrap min-w-[120px]"
          >
            {acceptText}
          </button>
        </div>
      </div>
    </div>
  );
}
