'use client';

import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Language, translations } from './translations';

export type TranslationType = (typeof translations)['en'];

export type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationType;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const isValidLanguage = (value: string): value is Language => {
  return ['en', 'de', 'fr', 'it', 'gsw'].includes(value as Language);
};

/**
 * LanguageProvider component that manages the application's language state.
 *
 * It handles:
 * - Persisting language preference to localStorage.
 * - Hydrating the language state from localStorage on the client side.
 * - Providing translations based on the current language.
 *
 * Hydration Considerations:
 * To avoid hydration mismatches between the server (SSR) and client, this component
 * uses a `mounted` state. It renders `null` until the component is mounted on the client,
 * ensuring that the initial render matches the server output before switching to the
 * user's preferred language. This is standard pattern for persistent client-side state
 * in Next.js.
 *
 * @param children - The child components that will have access to the language context.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from local storage if available
    const saved = localStorage.getItem('helvetia-lang');
    // Explicit validation to prevent XSS or invalid state
    if (saved && isValidLanguage(saved) && translations[saved]) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('helvetia-lang', lang);
  };

  // Prevent hydration mismatch by only rendering children after mount
  if (!mounted) {
    return null;
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleSetLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
