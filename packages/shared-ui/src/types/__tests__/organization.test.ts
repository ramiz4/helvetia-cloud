import { describe, expect, it } from 'vitest';
import { Role } from '../organization';

describe('organization types', () => {
  describe('Role enum', () => {
    it('should have ADMIN role', () => {
      expect(Role.ADMIN).toBe('ADMIN');
    });

    it('should have MEMBER role', () => {
      expect(Role.MEMBER).toBe('MEMBER');
    });

    it('should have VIEWER role', () => {
      expect(Role.VIEWER).toBe('VIEWER');
    });

    it('should have all defined roles', () => {
      const roles = Object.values(Role);
      expect(roles.length).toBeGreaterThanOrEqual(3);
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('MEMBER');
      expect(roles).toContain('VIEWER');
    });
  });
});
