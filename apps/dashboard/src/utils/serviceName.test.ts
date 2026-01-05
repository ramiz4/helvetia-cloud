import { describe, expect, it } from 'vitest';
import { sanitizeServiceName } from './serviceName';

describe('sanitizeServiceName', () => {
  it('should handle basic cases', () => {
    expect(sanitizeServiceName('my-repo')).toBe('my-repo');
    expect(sanitizeServiceName('MyRepo')).toBe('myrepo');
  });

  it('should handle consecutive special characters', () => {
    expect(sanitizeServiceName('my___repo')).toBe('my-repo');
    expect(sanitizeServiceName('my---repo')).toBe('my-repo');
    expect(sanitizeServiceName('my...repo')).toBe('my-repo');
    expect(sanitizeServiceName('my@@@repo')).toBe('my-repo');
  });

  it('should handle leading/trailing special characters', () => {
    expect(sanitizeServiceName('_myrepo')).toBe('myrepo');
    expect(sanitizeServiceName('myrepo_')).toBe('myrepo');
    expect(sanitizeServiceName('_myrepo_')).toBe('myrepo');
    expect(sanitizeServiceName('---myrepo---')).toBe('myrepo');
  });

  it('should handle complex cases', () => {
    expect(sanitizeServiceName('my_special___repo!!!')).toBe('my-special-repo');
    expect(sanitizeServiceName('@@@repo###name$$$')).toBe('repo-name');
  });

  it('should handle edge cases', () => {
    expect(sanitizeServiceName('')).toBe('');
    expect(sanitizeServiceName('___')).toBe('service');
    expect(sanitizeServiceName('123-repo')).toBe('123-repo');
    expect(sanitizeServiceName('-123-repo')).toBe('123-repo');
  });

  it('should comply with DNS 63 character limit', () => {
    expect(sanitizeServiceName('a'.repeat(70) + '-repo')).toBe('a'.repeat(63));
    expect(sanitizeServiceName('a'.repeat(62) + '---')).toBe('a'.repeat(62));
  });
});
