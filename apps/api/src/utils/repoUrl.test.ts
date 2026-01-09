import { describe, expect, it } from 'vitest';
import { getRepoUrlMatchCondition, normalizeRepoUrl } from './repoUrl';

describe('normalizeRepoUrl', () => {
  it('should remove .git suffix from URL', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo.git')).toBe(
      'https://github.com/user/repo',
    );
  });

  it('should trim whitespace', () => {
    expect(normalizeRepoUrl('  https://github.com/user/repo  ')).toBe(
      'https://github.com/user/repo',
    );
  });

  it('should handle URL without .git suffix', () => {
    expect(normalizeRepoUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo');
  });

  it('should handle .git suffix with trimming', () => {
    expect(normalizeRepoUrl('  https://github.com/user/repo.git  ')).toBe(
      'https://github.com/user/repo',
    );
  });

  it('should handle empty string', () => {
    expect(normalizeRepoUrl('')).toBe('');
  });

  it('should not remove .git from middle of URL', () => {
    expect(normalizeRepoUrl('https://github.com/.github/repo')).toBe(
      'https://github.com/.github/repo',
    );
  });

  it('should handle multiple .git suffixes (only remove last)', () => {
    expect(normalizeRepoUrl('https://github.com/user.git/repo.git')).toBe(
      'https://github.com/user.git/repo',
    );
  });
});

describe('getRepoUrlMatchCondition', () => {
  it('should return OR condition for normalized URL', () => {
    const condition = getRepoUrlMatchCondition('https://github.com/user/repo.git');
    expect(condition).toEqual({
      OR: [
        { repoUrl: 'https://github.com/user/repo' },
        { repoUrl: 'https://github.com/user/repo.git' },
      ],
    });
  });

  it('should handle URL without .git', () => {
    const condition = getRepoUrlMatchCondition('https://github.com/user/repo');
    expect(condition).toEqual({
      OR: [
        { repoUrl: 'https://github.com/user/repo' },
        { repoUrl: 'https://github.com/user/repo.git' },
      ],
    });
  });

  it('should trim whitespace in condition', () => {
    const condition = getRepoUrlMatchCondition('  https://github.com/user/repo  ');
    expect(condition).toEqual({
      OR: [
        { repoUrl: 'https://github.com/user/repo' },
        { repoUrl: 'https://github.com/user/repo.git' },
      ],
    });
  });

  it('should handle empty string', () => {
    const condition = getRepoUrlMatchCondition('');
    expect(condition).toEqual({ repoUrl: null });
  });
});
