import { describe, expect, it } from 'vitest';
import {
  formatValidationErrors,
  validateDockerfileSyntax,
  validateEnvironmentVariables,
  validateGeneratedDockerfile,
  type ValidationResult,
} from './dockerfile-validator';

describe('Dockerfile Validator', () => {
  describe('validateDockerfileSyntax', () => {
    it('should validate a correct Dockerfile', () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty Dockerfile', () => {
      const result = validateDockerfileSyntax('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Dockerfile is empty');
    });

    it('should reject Dockerfile without FROM instruction', () => {
      const dockerfile = `RUN apt-get update
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must start with a FROM instruction'))).toBe(
        true,
      );
    });

    it('should reject Dockerfile with invalid instruction', () => {
      const dockerfile = `FROM node:22-alpine
INVALID_COMMAND do something
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid or unrecognized instruction'))).toBe(
        true,
      );
    });

    it('should reject instruction without arguments', () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('missing arguments'))).toBe(true);
    });

    it('should validate FROM instruction with image name', () => {
      const dockerfile = `FROM 
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must specify an image'))).toBe(true);
    });

    it('should validate ENV instruction format', () => {
      const dockerfile = `FROM node:22-alpine
ENV
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('ENV instruction must be in format'))).toBe(true);
    });

    it('should validate EXPOSE instruction port numbers', () => {
      const dockerfile = `FROM node:22-alpine
EXPOSE 99999
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid port number'))).toBe(true);
    });

    it('should validate EXPOSE with invalid port', () => {
      const dockerfile = `FROM node:22-alpine
EXPOSE abc
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid port number'))).toBe(true);
    });

    it('should validate WORKDIR requires a path', () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR   
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('WORKDIR instruction requires a path'))).toBe(
        true,
      );
    });

    it('should warn about shell operators in CMD without exec form', () => {
      const dockerfile = `FROM node:22-alpine
CMD npm start && echo done`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('should use exec form'))).toBe(true);
    });

    it('should warn if no CMD or ENTRYPOINT is specified', () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR /app
COPY . .`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('should contain a CMD or ENTRYPOINT'))).toBe(
        true,
      );
    });

    it('should ignore comments', () => {
      const dockerfile = `# This is a comment
FROM node:22-alpine
# Another comment
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multi-stage builds', () => {
      const dockerfile = `FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ENV with KEY=VALUE format', () => {
      const dockerfile = `FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3000
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate ENV with KEY VALUE format', () => {
      const dockerfile = `FROM node:22-alpine
ENV NODE_ENV production
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate EXPOSE with protocol', () => {
      const dockerfile = `FROM node:22-alpine
EXPOSE 3000/tcp
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate multiple EXPOSE instructions', () => {
      const dockerfile = `FROM node:22-alpine
EXPOSE 3000 8080 9000
CMD ["npm", "start"]`;

      const result = validateDockerfileSyntax(dockerfile);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateEnvironmentVariables', () => {
    it('should validate correct environment variables', () => {
      const envVars = {
        NODE_ENV: 'production',
        PORT: '3000',
        API_KEY: 'secret123',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty or undefined envVars', () => {
      const result1 = validateEnvironmentVariables({});
      const result2 = validateEnvironmentVariables(undefined);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it('should reject invalid variable names starting with number', () => {
      const envVars = {
        '1INVALID': 'value',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid environment variable name'))).toBe(true);
    });

    it('should reject invalid variable names with special characters', () => {
      const envVars = {
        'INVALID-NAME': 'value',
        'INVALID.NAME': 'value',
        'INVALID NAME': 'value',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.every((e) => e.includes('Invalid environment variable name'))).toBe(
        true,
      );
    });

    it('should warn about reserved variable names', () => {
      const envVars = {
        PATH: '/usr/bin',
        HOME: '/root',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('reserved system variable'))).toBe(true);
    });

    it('should reject values with newline characters', () => {
      const envVars = {
        VALID_KEY: 'value\nwith newline',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('contains newline characters'))).toBe(true);
    });

    it('should reject values with carriage return characters', () => {
      const envVars = {
        VALID_KEY: 'value\rwith return',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('contains newline characters'))).toBe(true);
    });

    it('should warn about very long values', () => {
      const longValue = 'x'.repeat(10001);
      const envVars = {
        LONG_VAR: longValue,
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('very long value'))).toBe(true);
    });

    it('should accept valid variable names with underscores', () => {
      const envVars = {
        _VALID_NAME: 'value',
        VAR_WITH_UNDERSCORES: 'value',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle special characters in values', () => {
      const envVars = {
        API_KEY: 'key-with-dashes',
        SECRET: 'value_with_underscores',
        URL: 'https://example.com/path?query=value',
      };

      const result = validateEnvironmentVariables(envVars);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateGeneratedDockerfile', () => {
    it('should validate a complete generated Dockerfile', async () => {
      const dockerfile = `FROM node:22-alpine
RUN npm install -g pnpm
WORKDIR /app
ARG NODE_ENV
COPY package.json .
RUN pnpm install
COPY . .
ENV NODE_ENV=production
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]`;

      const envVars = {
        NODE_ENV: 'production',
        PORT: '3000',
      };

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
        envVars,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch both syntax and env var errors', async () => {
      const dockerfile = `INVALID INSTRUCTION
FROM node:22-alpine`;

      const envVars = {
        '1INVALID': 'value',
      };

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
        envVars,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors.some((e) => e.includes('must start with a FROM'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Invalid environment variable'))).toBe(true);
    });

    it('should validate static site Dockerfile', async () => {
      const dockerfile = `FROM node:22-alpine AS builder
RUN npm install -g pnpm
WORKDIR /app
COPY package.json .
RUN pnpm install
COPY . .
ENV NODE_ENV=production
RUN pnpm build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate without envVars', async () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR /app
CMD ["npm", "start"]`;

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format validation errors correctly', () => {
      const result: ValidationResult = {
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('❌ Dockerfile Validation Errors:');
      expect(formatted).toContain('1. Error 1');
      expect(formatted).toContain('2. Error 2');
      expect(formatted).toContain('⚠️  Dockerfile Validation Warnings:');
      expect(formatted).toContain('1. Warning 1');
    });

    it('should format only errors when no warnings', () => {
      const result: ValidationResult = {
        valid: false,
        errors: ['Error 1'],
        warnings: [],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toContain('❌ Dockerfile Validation Errors:');
      expect(formatted).not.toContain('⚠️  Dockerfile Validation Warnings:');
    });

    it('should format only warnings when no errors', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ['Warning 1'],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).not.toContain('❌ Dockerfile Validation Errors:');
      expect(formatted).toContain('⚠️  Dockerfile Validation Warnings:');
    });

    it('should show success message when valid', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const formatted = formatValidationErrors(result);

      expect(formatted).toBe('✅ Dockerfile validation passed');
    });
  });

  describe('Real-world Dockerfile scenarios', () => {
    it('should validate a typical Node.js application Dockerfile', async () => {
      const dockerfile = `FROM node:22-alpine
RUN apk add --no-cache git build-base python3
RUN npm install -g pnpm
WORKDIR /app
ARG DATABASE_URL
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
ENV NODE_ENV=production
ENV PORT=3000
RUN pnpm build
EXPOSE 3000
CMD ["sh", "-c", "pnpm start"]`;

      const envVars = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        NODE_ENV: 'production',
      };

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
        envVars,
      });

      expect(result.valid).toBe(true);
    });

    it('should validate a Next.js static export Dockerfile', async () => {
      const dockerfile = `FROM node:22-alpine AS builder
RUN apk add --no-cache git
RUN npm install -g pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
ENV NEXT_PUBLIC_API_URL=https://api.example.com
RUN pnpm build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;

      const envVars = {
        NEXT_PUBLIC_API_URL: 'https://api.example.com',
      };

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
        envVars,
      });

      expect(result.valid).toBe(true);
    });

    it('should catch common mistake: missing COPY before RUN', async () => {
      const dockerfile = `FROM node:22-alpine
WORKDIR /app
RUN pnpm install
COPY . .
CMD ["npm", "start"]`;

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
      });

      // This should still pass syntax validation, as Docker won't catch this
      // until runtime, but it's a common mistake
      expect(result.valid).toBe(true);
    });

    it('should validate Dockerfile with multiple ARG instructions', async () => {
      const dockerfile = `FROM node:22-alpine
ARG BUILD_ENV
ARG API_KEY
ARG VERSION
WORKDIR /app
COPY . .
RUN echo "Building version $VERSION"
CMD ["npm", "start"]`;

      const result = await validateGeneratedDockerfile({
        dockerfileContent: dockerfile,
      });

      expect(result.valid).toBe(true);
    });
  });
});
