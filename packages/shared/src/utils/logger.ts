import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    isDevelopment && !isTest
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
            singleLine: false,
          },
        }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'secret',
      'githubAccessToken',
    ],
    remove: true,
  },
});

export type Logger = typeof logger;
