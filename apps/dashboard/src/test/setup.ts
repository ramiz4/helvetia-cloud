import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock fetch
global.fetch = vi.fn();

// Suppress console error and warn logs in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
// Optionally suppress log as well if it's too noisy
// vi.spyOn(console, 'log').mockImplementation(() => {});
