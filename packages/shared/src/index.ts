/**
 * Shared package for common backend logic used by API and Worker
 * Contains Docker orchestration, Redis utilities, and distributed locks
 */

// Orchestration exports (for API/Worker)
export * from './orchestration';

// Utility exports (for API/Worker)
export * from './utils';
