'use client';

import { useLanguage } from 'shared-ui';
import CookieBanner from './CookieBanner';

/**
 * Client wrapper for CookieBanner to use translations from LanguageContext
 */
export default function CookieBannerWrapper() {
  const { t } = useLanguage();

  return <CookieBanner translations={t.cookie} />;
}
