import { vi } from 'vitest';

// Suppress console error and warn logs in tests
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

// Fastify level logs can be suppressed by setting logger: false or mocking the logger
// For console.log (which some fastify plugins or our own code might use):
vi.spyOn(console, 'log').mockImplementation(() => {});
