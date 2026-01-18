'use client';

import { useLanguage } from 'shared-ui';
import CookieBanner from './CookieBanner';

/**
 * Client wrapper for CookieBanner to use translations from LanguageContext
 */
export default function CookieBannerWrapper() {
  const { t } = useLanguage();

  return <CookieBanner title={t.cookie.title} text={t.cookie.text} acceptText={t.cookie.accept} />;
}
