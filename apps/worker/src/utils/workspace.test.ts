import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureWorkspaceDir, getSecureBindMounts, getWorkspaceDir } from './workspace';

describe('Workspace Utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getWorkspaceDir', () => {
    it('should return default workspace directory when WORKSPACE_DIR is not set', () => {
      delete process.env.WORKSPACE_DIR;
      expect(getWorkspaceDir()).toBe('/tmp/helvetia-workspaces');
    });

    it('should return WORKSPACE_DIR from environment when set', () => {
      process.env.WORKSPACE_DIR = '/custom/workspace';
      expect(getWorkspaceDir()).toBe('/custom/workspace');
    });
  });

  describe('getSecureBindMounts', () => {
    it('should return secure bind mounts with docker socket only', () => {
      delete process.env.WORKSPACE_DIR;
      const mounts = getSecureBindMounts();

      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toBe('/var/run/docker.sock:/var/run/docker.sock');
    });

    it('should not include workspace mount', () => {
      const mounts = getSecureBindMounts();
      const workspaceMount = mounts.find((m) => m.includes('/workspaces'));

      expect(workspaceMount).toBeUndefined();
    });

    it('should not include /Users mount', () => {
      const mounts = getSecureBindMounts();

      expect(mounts.some((m) => m.includes('/Users'))).toBe(false);
    });

    it('should not include root directory mounts', () => {
      const mounts = getSecureBindMounts();
      const dangerousMounts = mounts.filter((m) => {
        const hostPath = m.split(':')[0];
        return hostPath === '/' || hostPath === '/Users' || hostPath === '/home';
      });

      expect(dangerousMounts).toHaveLength(0);
    });
  });

  describe('ensureWorkspaceDir', () => {
    it('should create workspace directory if it does not exist', async () => {
      const testDir = path.join('/tmp', `test-workspace-${Date.now()}`);
      process.env.WORKSPACE_DIR = testDir;

      try {
        await ensureWorkspaceDir();
        const stats = await fs.stat(testDir);
        expect(stats.isDirectory()).toBe(true);
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should not fail if workspace directory already exists', async () => {
      const testDir = path.join('/tmp', `test-workspace-${Date.now()}`);
      process.env.WORKSPACE_DIR = testDir;

      try {
        await fs.mkdir(testDir, { recursive: true });
        expect(ensureWorkspaceDir()).resolves.not.toThrow();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
