import { describe, expect, it } from 'vitest';
import {
  generatePrepareScript,
  generateRandomString,
  generateSetupScript,
  SetupConfig,
} from './script-generators';

describe('script-generators', () => {
  describe('generateRandomString', () => {
    it('should generate a string of specified length', () => {
      const result = generateRandomString(32);
      expect(result).toHaveLength(32);
    });

    it('should generate a hex string when hex=true', () => {
      const result = generateRandomString(32, true);
      expect(result).toHaveLength(32);
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate different strings on each call', () => {
      const result1 = generateRandomString(32);
      const result2 = generateRandomString(32);
      expect(result1).not.toBe(result2);
    });

    it('should handle length of 0', () => {
      const result = generateRandomString(0);
      expect(result).toBe('');
    });

    it('should handle various lengths', () => {
      expect(generateRandomString(10)).toHaveLength(10);
      expect(generateRandomString(64)).toHaveLength(64);
      expect(generateRandomString(128)).toHaveLength(128);
    });
  });

  describe('generatePrepareScript', () => {
    it('should return a bash script as a string', () => {
      const script = generatePrepareScript();
      expect(typeof script).toBe('string');
      expect(script).toContain('#!/bin/bash');
    });

    it('should include system update commands', () => {
      const script = generatePrepareScript();
      expect(script).toContain('apt-get update');
      expect(script).toContain('apt-get upgrade');
    });

    it('should include firewall configuration', () => {
      const script = generatePrepareScript();
      expect(script).toContain('ufw');
      expect(script).toContain('ufw allow 22/tcp');
      expect(script).toContain('ufw allow 80/tcp');
      expect(script).toContain('ufw allow 443/tcp');
    });

    it('should include swap file creation', () => {
      const script = generatePrepareScript();
      expect(script).toContain('swapfile');
      expect(script).toContain('2G');
    });

    it('should include Docker installation', () => {
      const script = generatePrepareScript();
      expect(script).toContain('docker');
      expect(script).toContain('get.docker.com');
    });

    it('should include Docker log configuration', () => {
      const script = generatePrepareScript();
      expect(script).toContain('log-driver');
      expect(script).toContain('json-file');
      expect(script).toContain('max-size');
    });

    it('should set bash to exit on error', () => {
      const script = generatePrepareScript();
      expect(script).toContain('set -e');
    });
  });

  describe('generateSetupScript', () => {
    const mockConfig: SetupConfig = {
      domain: 'example.com',
      email: 'admin@example.com',
      postgresPassword: 'test-password',
      grafanaPassword: 'grafana-pass',
      githubClientId: 'github-id',
      githubClientSecret: 'github-secret',
      jwtSecret: 'jwt-secret',
      cookieSecret: 'cookie-secret',
      encryptionKey: 'encryption-key-32-characters!!',
      encryptionSalt: 'abcdef0123456789',
      repoUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      helvetiaAdmin: 'admin',
      helvetiaAdminPassword: 'admin-password',
    };

    it('should return a bash script as a string', () => {
      const script = generateSetupScript(mockConfig);
      expect(typeof script).toBe('string');
      expect(script).toContain('#!/bin/bash');
    });

    it('should include domain name in script', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain(mockConfig.domain);
    });

    it('should include email in script', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain(mockConfig.email);
    });

    it('should include repository URL and branch', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain(mockConfig.repoUrl);
      expect(script).toContain(mockConfig.branch);
    });

    it('should include all required environment variables', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('DOMAIN_NAME=');
      expect(script).toContain('ACME_EMAIL=');
      expect(script).toContain('POSTGRES_PASSWORD=');
      expect(script).toContain('DATABASE_URL=');
      expect(script).toContain('GRAFANA_PASSWORD=');
      expect(script).toContain('GITHUB_CLIENT_ID=');
      expect(script).toContain('GITHUB_CLIENT_SECRET=');
      expect(script).toContain('JWT_SECRET=');
      expect(script).toContain('COOKIE_SECRET=');
      expect(script).toContain('ENCRYPTION_KEY=');
      expect(script).toContain('ENCRYPTION_SALT=');
      expect(script).toContain('HELVETIA_ADMIN=');
      expect(script).toContain('HELVETIA_ADMIN_PASSWORD=');
    });

    it('should include git clone/pull logic', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('git clone');
      expect(script).toContain('git pull');
      expect(script).toContain('git checkout');
    });

    it('should include docker compose commands', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('docker compose');
      expect(script).toContain('docker-compose.prod.yml');
      expect(script).toContain('up -d --build');
    });

    it('should include database migration step', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('migrate:deploy');
      expect(script).toContain('pg_isready');
    });

    it('should display deployment URLs at the end', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain(`https://${mockConfig.domain}`);
      expect(script).toContain(`https://api.${mockConfig.domain}`);
      expect(script).toContain(`https://monitor.${mockConfig.domain}`);
    });

    it('should escape special characters in passwords', () => {
      const configWithSpecialChars: SetupConfig = {
        ...mockConfig,
        postgresPassword: 'pass$word',
        grafanaPassword: 'graf$ana',
      };
      const script = generateSetupScript(configWithSpecialChars);
      // The escapeEnv function should double dollar signs
      expect(script).toContain('pass$$word');
      expect(script).toContain('graf$$ana');
    });

    it('should set bash to exit on error', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('set -e');
    });

    it('should create necessary directories', () => {
      const script = generateSetupScript(mockConfig);
      expect(script).toContain('mkdir -p');
      expect(script).toContain('letsencrypt');
      expect(script).toContain('postgres_data');
      expect(script).toContain('prometheus_data');
      expect(script).toContain('grafana_data');
    });
  });
});
