import { describe, expect, it } from 'vitest';
import { DockerfileBuilder } from './DockerfileBuilder';

describe('DockerfileBuilder', () => {
  describe('Basic Instructions', () => {
    it('should build a simple Dockerfile with FROM instruction', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder.from('node:22-alpine').build();

      expect(dockerfile).toBe('FROM node:22-alpine');
    });

    it('should chain multiple instructions', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder
        .from('node:22-alpine')
        .workdir('/app')
        .run('npm install')
        .expose(3000)
        .cmd(['npm', 'start'])
        .build();

      expect(dockerfile).toContain('FROM node:22-alpine');
      expect(dockerfile).toContain('WORKDIR /app');
      expect(dockerfile).toContain('RUN npm install');
      expect(dockerfile).toContain('EXPOSE 3000');
      expect(dockerfile).toContain('CMD ["npm", "start"]');
    });

    it('should add ENV instructions', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder.from('node:22-alpine').env('NODE_ENV', 'production').build();

      expect(dockerfile).toContain('ENV NODE_ENV=production');
    });

    it('should add ARG instructions', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder.from('node:22-alpine').arg('BUILD_VERSION').build();

      expect(dockerfile).toContain('ARG BUILD_VERSION');
    });

    it('should add COPY instructions', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder.from('node:22-alpine').copy('package.json', './').build();

      expect(dockerfile).toContain('COPY package.json ./');
    });

    it('should add raw lines', () => {
      const builder = new DockerfileBuilder();
      const dockerfile = builder.from('node:22-alpine').raw('# This is a comment').build();

      expect(dockerfile).toContain('# This is a comment');
    });

    it('should reset builder state', () => {
      const builder = new DockerfileBuilder();
      builder.from('node:22-alpine').workdir('/app').reset();
      const dockerfile = builder.from('alpine:latest').build();

      expect(dockerfile).toBe('FROM alpine:latest');
      expect(dockerfile).not.toContain('node:22-alpine');
    });
  });

  describe('buildNodeService', () => {
    it('should build a standard Node.js service Dockerfile', () => {
      const dockerfile = DockerfileBuilder.buildNodeService({
        port: 3000,
        buildCommand: 'npm run build',
        startCommand: 'npm start',
      });

      expect(dockerfile).toContain('FROM node:22-alpine');
      expect(dockerfile).toContain('RUN npm install -g pnpm');
      expect(dockerfile).toContain('WORKDIR /app');
      expect(dockerfile).toContain('COPY package*.json pnpm-lock.yaml* ./ ./');
      expect(dockerfile).toContain('RUN pnpm install');
      expect(dockerfile).toContain('COPY . . .');
      expect(dockerfile).toContain('RUN npm run build');
      expect(dockerfile).toContain('EXPOSE 3000');
      expect(dockerfile).toContain('CMD ["sh", "-c", "npm start"]');
    });

    it('should include environment variables as ARG and ENV', () => {
      const dockerfile = DockerfileBuilder.buildNodeService({
        envVars: {
          NODE_ENV: 'production',
          API_URL: 'https://api.example.com',
        },
        port: 3000,
      });

      expect(dockerfile).toContain('ARG NODE_ENV');
      expect(dockerfile).toContain('ARG API_URL');
      expect(dockerfile).toContain('ENV NODE_ENV=production');
      expect(dockerfile).toContain('ENV API_URL=https://api.example.com');
    });

    it('should use default commands when not provided', () => {
      const dockerfile = DockerfileBuilder.buildNodeService({
        port: 3000,
      });

      expect(dockerfile).toContain('RUN pnpm build');
      expect(dockerfile).toContain('CMD ["sh", "-c", "pnpm start"]');
    });

    it('should use default port when not provided', () => {
      const dockerfile = DockerfileBuilder.buildNodeService({});

      expect(dockerfile).toContain('EXPOSE 3000');
    });
  });

  describe('buildStaticSite', () => {
    it('should build a multi-stage Dockerfile for static sites', () => {
      const dockerfile = DockerfileBuilder.buildStaticSite({
        buildCommand: 'npm run build',
        staticOutputDir: 'dist',
      });

      // Check build stage
      expect(dockerfile).toContain('FROM node:22-alpine AS builder');
      expect(dockerfile).toContain('RUN npm install -g pnpm');
      expect(dockerfile).toContain('WORKDIR /app');
      expect(dockerfile).toContain('COPY package*.json pnpm-lock.yaml* ./ ./');
      expect(dockerfile).toContain('RUN pnpm install');
      expect(dockerfile).toContain('COPY . . .');
      expect(dockerfile).toContain('RUN npm run build');

      // Check runtime stage
      expect(dockerfile).toContain('FROM nginx:alpine');
      expect(dockerfile).toContain('RUN rm -rf /usr/share/nginx/html/*');
      expect(dockerfile).toContain('COPY --from=builder /app/dist /usr/share/nginx/html');
      expect(dockerfile).toContain('COPY nginx.conf /etc/nginx/conf.d/default.conf');
      expect(dockerfile).toContain('EXPOSE 80');
      expect(dockerfile).toContain('CMD ["nginx", "-g", "daemon off;"]');
    });

    it('should include build-time environment variables', () => {
      const dockerfile = DockerfileBuilder.buildStaticSite({
        envVars: {
          VITE_API_URL: 'https://api.example.com',
          PUBLIC_URL: '/app',
        },
        buildCommand: 'pnpm build',
      });

      expect(dockerfile).toContain('ARG VITE_API_URL');
      expect(dockerfile).toContain('ARG PUBLIC_URL');
      expect(dockerfile).toContain('ENV VITE_API_URL=https://api.example.com');
      expect(dockerfile).toContain('ENV PUBLIC_URL=/app');
    });

    it('should use default values when not provided', () => {
      const dockerfile = DockerfileBuilder.buildStaticSite({});

      expect(dockerfile).toContain('RUN pnpm build');
      expect(dockerfile).toContain('COPY --from=builder /app/dist /usr/share/nginx/html');
    });

    it('should include directory listing command', () => {
      const dockerfile = DockerfileBuilder.buildStaticSite({});

      expect(dockerfile).toContain("RUN ls -R /app | grep ': ' || true");
    });
  });
});
