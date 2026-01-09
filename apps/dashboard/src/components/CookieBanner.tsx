'use client';

import { useEffect, useState } from 'react';

/**
 * Props for the {@link CookieBanner} component.
 *
 * @property text - Informational text shown in the banner body. Typically explains cookie usage and links to the privacy policy.
 * @property acceptText - Label for the accept button that records the user's consent.
 */
interface CookieBannerProps {
  title: string;
  text: string;
  acceptText: string;
}

/**
 * Cookie consent banner for GDPR/DSGVO compliance.
 *
 * This client-side component:
 * - Reads the user's consent state from {@link Window.localStorage} using the key `cookie_consent`.
 * - Shows the banner only when no prior consent value is stored.
 * - When the user clicks the accept button, stores the string value `"true"` under the `cookie_consent` key
 *   and hides the banner for subsequent visits on the same browser.
 *
 * The initial state is set to accepted to avoid a flash of the banner during hydration; a side effect
 * then checks the persisted consent value and updates the visibility accordingly.
 *
 * @param props - Configuration for the banner content.
 * @param props.text - Informational message about cookie usage displayed in the banner.
 * @param props.acceptText - Text shown on the accept button.
 */
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
    <div
      className="fixed bottom-0 left-0 right-0 p-4 z-50 animate-fade-in"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-description"
    >
      <div className="container max-w-4xl mx-auto">
        <div className="bg-slate-900/60 backdrop-blur-xl p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/10 shadow-2xl">
          <div className="text-sm md:text-base text-slate-200">
            <span id="cookie-banner-title" className="font-bold block mb-1 text-white">
              {title}
            </span>
            <span id="cookie-banner-description">{text}</span>
          </div>
          <button
            onClick={handleAcceptCookies}
            className="px-8 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/20 whitespace-nowrap min-w-[140px]"
            aria-label={acceptText}
          >
            {acceptText}
          </button>
        </div>
      </div>
    </div>
  );
}
