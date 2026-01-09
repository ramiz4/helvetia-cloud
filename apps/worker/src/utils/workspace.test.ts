import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupWorkspace,
  ensureWorkspaceDir,
  getSecureBindMounts,
  getWorkspaceDir,
} from './workspace';

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
    it('should return secure bind mounts with docker socket and workspace directory', () => {
      delete process.env.WORKSPACE_DIR;
      const mounts = getSecureBindMounts();

      expect(mounts).toHaveLength(2);
      expect(mounts[0]).toBe('/var/run/docker.sock:/var/run/docker.sock');
      expect(mounts[1]).toBe('/tmp/helvetia-workspaces:/workspaces:ro');
    });

    it('should mount workspace as read-only', () => {
      const mounts = getSecureBindMounts();
      const workspaceMount = mounts.find((m) => m.includes('/workspaces'));

      expect(workspaceMount).toBeDefined();
      expect(workspaceMount).toContain(':ro');
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

    it('should use custom WORKSPACE_DIR when set', () => {
      process.env.WORKSPACE_DIR = '/custom/path';
      const mounts = getSecureBindMounts();

      expect(mounts[1]).toBe('/custom/path:/workspaces:ro');
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
        await expect(ensureWorkspaceDir()).resolves.not.toThrow();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('cleanupWorkspace', () => {
    it('should clean up old directories', async () => {
      const testDir = path.join('/tmp', `test-workspace-${Date.now()}`);
      process.env.WORKSPACE_DIR = testDir;

      try {
        await fs.mkdir(testDir, { recursive: true });

        const oldDir = path.join(testDir, 'old-dir');
        await fs.mkdir(oldDir);

        // Set the mtime to 2 days ago
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        await fs.utimes(oldDir, twoDaysAgo, twoDaysAgo);

        await cleanupWorkspace(24 * 60 * 60 * 1000); // 1 day

        // Check if old directory was removed
        await expect(fs.access(oldDir)).rejects.toThrow();
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should not clean up recent directories', async () => {
      const testDir = path.join('/tmp', `test-workspace-${Date.now()}`);
      process.env.WORKSPACE_DIR = testDir;

      try {
        await fs.mkdir(testDir, { recursive: true });

        const recentDir = path.join(testDir, 'recent-dir');
        await fs.mkdir(recentDir);

        await cleanupWorkspace(24 * 60 * 60 * 1000); // 1 day

        // Check if recent directory still exists
        const stats = await fs.stat(recentDir);
        expect(stats.isDirectory()).toBe(true);
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle non-existent workspace directory gracefully', async () => {
      process.env.WORKSPACE_DIR = '/non-existent-workspace';
      await expect(cleanupWorkspace()).resolves.not.toThrow();
    });
  });
});
