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
