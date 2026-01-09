import { describe, expect, it } from 'vitest';
import { getSecureBindMounts } from './workspace';

describe('Workspace Utils', () => {
  describe('getSecureBindMounts', () => {
    it('should only mount Docker socket', () => {
      const mounts = getSecureBindMounts();

      expect(mounts).toHaveLength(1);
      expect(mounts[0]).toBe('/var/run/docker.sock:/var/run/docker.sock');
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

    it('should not mount any host directories', () => {
      const mounts = getSecureBindMounts();

      // Filter out the Docker socket mount
      const hostDirMounts = mounts.filter((mount) => {
        const hostPath = mount.split(':')[0];
        return hostPath !== '/var/run/docker.sock';
      });

      // Should not mount any host directories
      expect(hostDirMounts).toHaveLength(0);
    });
  });
});
