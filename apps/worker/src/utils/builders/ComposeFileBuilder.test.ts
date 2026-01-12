import { describe, expect, it } from 'vitest';
import { ComposeFileBuilder } from './ComposeFileBuilder';

describe('ComposeFileBuilder', () => {
  describe('generateOverride', () => {
    it('should generate a valid Docker Compose override YAML', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'app',
        traefikRule: 'Host(`my-app.localhost`)',
        port: 8080,
        username: 'testuser',
      });

      expect(result).toContain('services:');
      expect(result).toContain('app:');
      expect(result).toContain('helvetia.serviceId=service-123');
      expect(result).toContain('traefik.enable=true');
      expect(result).toContain(
        'traefik.http.routers.testuser-my-app.rule=Host(`my-app.localhost`)',
      );
      expect(result).toContain('traefik.http.routers.testuser-my-app.entrypoints=web');
      expect(result).toContain(
        'traefik.http.services.testuser-my-app.loadbalancer.server.port=8080',
      );
      expect(result).toContain('networks:');
      expect(result).toContain('helvetia-net:');
      expect(result).toContain('project-net:');
      expect(result).toContain('external: true');
      expect(result).toContain('name: helvetia-net');
    });

    it('should include environment variables when provided', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'app',
        traefikRule: 'Host(`my-app.localhost`)',
        port: 8080,
        envVars: {
          NODE_ENV: 'production',
          API_KEY: 'secret123',
        },
      });

      expect(result).toContain('environment:');
      expect(result).toContain('NODE_ENV: production');
      expect(result).toContain('API_KEY: secret123');
    });

    it('should not include environment section when no variables provided', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'app',
        traefikRule: 'Host(`my-app.localhost`)',
        port: 8080,
      });

      expect(result).not.toContain('environment:');
    });

    it('should use default port 8080 when not provided', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'app',
        traefikRule: 'Host(`my-app.localhost`)',
        username: 'testuser',
      });

      expect(result).toContain(
        'traefik.http.services.testuser-my-app.loadbalancer.server.port=8080',
      );
    });

    it('should handle complex Traefik rules', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'web',
        traefikRule:
          'Host(`my-app.helvetia.cloud`) || Host(`my-app.localhost`) || Host(`custom.domain.com`)',
        port: 3000,
        username: 'testuser',
      });

      // YAML may wrap long lines, so check for the parts separately
      expect(result).toContain(
        'traefik.http.routers.testuser-my-app.rule=Host(`my-app.helvetia.cloud`)',
      );
      expect(result).toContain('Host(`my-app.localhost`)');
      expect(result).toContain('Host(`custom.domain.com`)');
    });

    it('should handle different main service names', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'backend',
        traefikRule: 'Host(`my-app.localhost`)',
        port: 8080,
      });

      expect(result).toContain('backend:');
      expect(result).not.toContain('app:');
    });

    it('should generate valid YAML format', () => {
      const result = ComposeFileBuilder.generateOverride({
        serviceName: 'my-app',
        serviceId: 'service-123',
        mainService: 'app',
        traefikRule: 'Host(`my-app.localhost`)',
        port: 8080,
      });

      // Basic YAML format checks
      expect(result).toMatch(/services:\s+app:/);
      expect(result).toMatch(/networks:\s+helvetia-net:/);
      // Should not have duplicate keys
      const lines = result.split('\n');
      const serviceOccurrences = lines.filter((line) => line.match(/^services:/)).length;
      expect(serviceOccurrences).toBe(1);
    });
  });
});
