import { describe, expect, it } from 'vitest';
import { generateDockerComposeScript, generateDockerInstallScript } from '../script-generators';

describe('script-generators', () => {
  describe('generateDockerInstallScript', () => {
    it('should generate Ubuntu/Debian script', () => {
      const script = generateDockerInstallScript('ubuntu');

      expect(script).toContain('apt-get update');
      expect(script).toContain('docker-ce');
      expect(script).toContain('docker-compose-plugin');
    });

    it('should generate CentOS/RHEL script', () => {
      const script = generateDockerInstallScript('centos');

      expect(script).toContain('yum-config-manager');
      expect(script).toContain('docker-ce');
      expect(script).toContain('docker-compose-plugin');
    });

    it('should default to Ubuntu for unknown OS', () => {
      const script = generateDockerInstallScript('unknown' as any);

      expect(script).toContain('apt-get update');
    });
  });

  describe('generateDockerComposeScript', () => {
    it('should generate docker-compose script with platform domain', () => {
      const script = generateDockerComposeScript('example.com');

      expect(script).toContain('version:');
      expect(script).toContain('services:');
      expect(script).toContain('example.com');
      expect(script).toContain('postgres:');
      expect(script).toContain('redis:');
    });

    it('should include traefik configuration', () => {
      const script = generateDockerComposeScript('example.com');

      expect(script).toContain('traefik:');
      expect(script).toContain('--providers.docker=true');
    });

    it('should include environment variables', () => {
      const script = generateDockerComposeScript('test.io');

      expect(script).toContain('DATABASE_URL');
      expect(script).toContain('REDIS_URL');
    });
  });
});
