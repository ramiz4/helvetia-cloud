'use client';

import { Cookie, Settings, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Cookie consent preferences
 */
interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
}

/**
 * Cookie translations interface
 */
interface CookieTranslations {
  title: string;
  text: string;
  accept: string;
  rejectNonEssential: string;
  customize: string;
  savePreferences: string;
  learnMore: string;
  preferences: {
    title: string;
    essential: {
      title: string;
      description: string;
    };
    functional: {
      title: string;
      description: string;
    };
    analytics: {
      title: string;
      description: string;
    };
  };
}

/**
 * Props for the {@link CookieBanner} component.
 */
interface CookieBannerProps {
  translations: CookieTranslations;
}

/**
 * Cookie consent banner for GDPR/DSGVO compliance with granular preferences.
 *
 * This client-side component:
 * - Reads the user's consent state from {@link Window.localStorage} using the key `cookie_consent`.
 * - Shows the banner only when no prior consent value is stored.
 * - Allows users to customize cookie preferences (essential, functional, analytics)
 * - Essential cookies cannot be disabled (required for authentication and security)
 * - When the user clicks the accept button, stores the preferences under the `cookie_consent` key
 *   and hides the banner for subsequent visits on the same browser.
 *
 * The initial state is set to accepted to avoid a flash of the banner during hydration; a side effect
 * then checks the persisted consent value and updates the visibility accordingly.
 *
 * @param props - Configuration for the banner content.
 */
export default function CookieBanner({ translations: t }: CookieBannerProps) {
  const [accepted, setAccepted] = useState(true); // Default to true to avoid flash, check useEffect
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be changed
    functional: true,
    analytics: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const consent = window.localStorage.getItem('cookie_consent');
    if (!consent) {
      setAccepted(false);
    } else {
      try {
        const savedPreferences = JSON.parse(consent) as CookiePreferences;
        setPreferences(savedPreferences);
      } catch {
        // If parsing fails, treat as not consented
        setAccepted(false);
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      essential: true,
      functional: true,
      analytics: true,
    };
    savePreferences(allAccepted);
  };

  const handleAcceptSelected = () => {
    savePreferences(preferences);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly: CookiePreferences = {
      essential: true,
      functional: false,
      analytics: false,
    };
    savePreferences(essentialOnly);
  };

  const savePreferences = (prefs: CookiePreferences) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cookie_consent', JSON.stringify(prefs));
    }
    setPreferences(prefs);
    setAccepted(true);
    setShowPreferences(false);
  };

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === 'essential') return; // Essential cookies cannot be toggled
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
        <div className="bg-slate-900/95 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-indigo-400" />
              </div>
              <h2 id="cookie-banner-title" className="text-lg font-bold text-white">
                {t.title}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p id="cookie-banner-description" className="text-sm text-slate-300 mb-4">
            {t.text}{' '}
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">
              {t.learnMore}
            </Link>
          </p>

          {/* Preferences Toggle */}
          {!showPreferences && (
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <button
                onClick={handleAcceptAll}
                className="flex-1 px-6 py-3 rounded-xl font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                aria-label={t.accept}
              >
                {t.accept}
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="px-6 py-3 rounded-xl font-semibold bg-slate-700 text-white hover:bg-slate-600 transition-all active:scale-95"
                aria-label={t.rejectNonEssential}
              >
                {t.rejectNonEssential}
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="px-6 py-3 rounded-xl font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                aria-label={t.customize}
              >
                <Settings className="w-4 h-4" />
                {t.customize}
              </button>
            </div>
          )}

          {/* Preferences Panel */}
          {showPreferences && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <h3 className="text-sm font-semibold text-white">{t.preferences.title}</h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Close preferences"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Essential Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {t.preferences.essential.title}
                  </h4>
                  <p className="text-xs text-slate-400">{t.preferences.essential.description}</p>
                </div>
                <div className="ml-4">
                  <div className="w-12 h-6 bg-indigo-500 rounded-full relative cursor-not-allowed opacity-50">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {t.preferences.functional.title}
                  </h4>
                  <p className="text-xs text-slate-400">{t.preferences.functional.description}</p>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => togglePreference('functional')}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      preferences.functional ? 'bg-indigo-500' : 'bg-slate-600'
                    }`}
                    aria-label={`Toggle functional cookies ${preferences.functional ? 'off' : 'on'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        preferences.functional ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {t.preferences.analytics.title}
                  </h4>
                  <p className="text-xs text-slate-400">{t.preferences.analytics.description}</p>
                </div>
                <div className="ml-4">
                  <button
                    onClick={() => togglePreference('analytics')}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      preferences.analytics ? 'bg-indigo-500' : 'bg-slate-600'
                    }`}
                    aria-label={`Toggle analytics cookies ${preferences.analytics ? 'off' : 'on'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        preferences.analytics ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Save Preferences Button */}
              <div className="pt-4 border-t border-slate-700">
                <button
                  onClick={handleAcceptSelected}
                  className="w-full px-6 py-3 rounded-xl font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                  aria-label={t.savePreferences}
                >
                  {t.savePreferences}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
