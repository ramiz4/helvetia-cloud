/**
 * Shared UI package for frontend applications (Dashboard and Admin)
 * Contains React components, i18n utilities, configuration, and types
 */

// UI Components
export { ConfirmationModal } from './ui/ConfirmationModal';

// Configuration & Environment
export {
  API_BASE_URL,
  APP_BASE_URL,
  GITHUB_CLIENT_ID,
  PLATFORM_DOMAIN,
  WS_BASE_URL,
  env,
} from './config/config';

// Authentication & Token Management
export { checkAndRefreshToken, fetchWithAuth, refreshAccessToken } from './config/tokenRefresh';

// Internationalization
export { LanguageProvider, useLanguage } from './config/LanguageContext';
export { translations } from './config/translations';
export type { Language, Translations } from './config/translations';

// Type Definitions
export { Role } from './types/organization';
export type { Organization, OrganizationMember } from './types/organization';
