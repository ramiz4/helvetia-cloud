import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useServerSetup } from './useServerSetup';

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe('useServerSetup', () => {
  it('should initialize with default config values', () => {
    const { result } = renderHook(() => useServerSetup());

    expect(result.current.config.domain).toBe('example.com');
    expect(result.current.config.email).toBe('admin@example.com');
    expect(result.current.config.repoUrl).toBe('https://github.com/ramiz4/helvetia-cloud.git');
    expect(result.current.config.branch).toBe('main');
    expect(result.current.config.helvetiaAdmin).toBe('admin');
  });

  it('should initialize with empty password fields', () => {
    const { result } = renderHook(() => useServerSetup());

    expect(result.current.config.postgresPassword).toBe('');
    expect(result.current.config.grafanaPassword).toBe('');
    expect(result.current.config.githubClientSecret).toBe('');
    expect(result.current.config.jwtSecret).toBe('');
    expect(result.current.config.cookieSecret).toBe('');
    expect(result.current.config.encryptionKey).toBe('');
    expect(result.current.config.encryptionSalt).toBe('');
    expect(result.current.config.helvetiaAdminPassword).toBe('');
  });

  it('should set active tab to "prepare" by default', () => {
    const { result } = renderHook(() => useServerSetup());

    expect(result.current.activeTab).toBe('prepare');
  });

  it('should set copied to false by default', () => {
    const { result } = renderHook(() => useServerSetup());

    expect(result.current.copied).toBe(false);
  });

  it('should update config when updateConfig is called', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.updateConfig({ domain: 'newdomain.com' });
    });

    expect(result.current.config.domain).toBe('newdomain.com');
  });

  it('should update multiple config values at once', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.updateConfig({
        domain: 'test.com',
        email: 'test@test.com',
        branch: 'develop',
      });
    });

    expect(result.current.config.domain).toBe('test.com');
    expect(result.current.config.email).toBe('test@test.com');
    expect(result.current.config.branch).toBe('develop');
  });

  it('should generate random string with handleGenerate', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.handleGenerate('jwtSecret', 32, false);
    });

    expect(result.current.config.jwtSecret).toHaveLength(32);
    expect(result.current.config.jwtSecret).not.toBe('');
  });

  it('should generate hex string when hex=true', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.handleGenerate('encryptionSalt', 16, true);
    });

    expect(result.current.config.encryptionSalt).toHaveLength(16);
    expect(result.current.config.encryptionSalt).toMatch(/^[0-9a-f]+$/);
  });

  it('should change active tab when setActiveTab is called', () => {
    const { result } = renderHook(() => useServerSetup());

    expect(result.current.activeTab).toBe('prepare');

    act(() => {
      result.current.setActiveTab('setup');
    });

    expect(result.current.activeTab).toBe('setup');
  });

  it('should copy prepare script to clipboard', async () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.setActiveTab('prepare');
    });

    await act(async () => {
      result.current.handleCopy();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(result.current.copied).toBe(true);
  });

  it('should copy setup script to clipboard', async () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.setActiveTab('setup');
    });

    await act(async () => {
      result.current.handleCopy();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(result.current.copied).toBe(true);
  });

  it('should reset copied state after 2 seconds', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useServerSetup());

    await act(async () => {
      result.current.handleCopy();
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);

    vi.useRealTimers();
  });

  it('should return prepare script when activeTab is "prepare"', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.setActiveTab('prepare');
    });

    expect(result.current.currentScript).toContain('#!/bin/bash');
    expect(result.current.currentScript).toContain('Helvetia Cloud Server Preparation Script');
  });

  it('should return setup script when activeTab is "setup"', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.setActiveTab('setup');
      result.current.updateConfig({ domain: 'mydomain.com' });
    });

    expect(result.current.currentScript).toContain('#!/bin/bash');
    expect(result.current.currentScript).toContain('Helvetia Cloud Application Setup Script');
    expect(result.current.currentScript).toContain('mydomain.com');
  });

  it('should preserve previous config values when updating one field', () => {
    const { result } = renderHook(() => useServerSetup());

    act(() => {
      result.current.updateConfig({
        domain: 'first.com',
        email: 'first@email.com',
      });
    });

    act(() => {
      result.current.updateConfig({ domain: 'second.com' });
    });

    expect(result.current.config.domain).toBe('second.com');
    expect(result.current.config.email).toBe('first@email.com');
  });
});
