import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { handleGitHubLogin, getPlatformBenefits } from './auth';

describe('handleGitHubLogin', () => {
  let originalLocation: Location;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalLocation = window.location;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
    } as string & Location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    consoleErrorSpy.mockRestore();
  });

  it('should redirect to GitHub OAuth with valid client ID', () => {
    const clientId = 'test-client-id';
    handleGitHubLogin(clientId);

    expect(window.location.href).toBe(
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=http://localhost:3000/auth/callback&scope=user,repo,read:org,read:packages`,
    );
  });

  it('should construct correct redirect URI based on origin', () => {
    window.location.origin = 'https://example.com';
    const clientId = 'test-client-id';
    handleGitHubLogin(clientId);

    expect(window.location.href).toContain('redirect_uri=https://example.com/auth/callback');
  });

  it('should include correct OAuth scopes', () => {
    const clientId = 'test-client-id';
    handleGitHubLogin(clientId);

    expect(window.location.href).toContain('scope=user,repo,read:org,read:packages');
  });

  it('should log error and not redirect when client ID is undefined', () => {
    handleGitHubLogin(undefined);

    expect(consoleErrorSpy).toHaveBeenCalledWith('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
    expect(window.location.href).toBe('http://localhost:3000');
  });

  it('should log error and not redirect when client ID is empty string', () => {
    handleGitHubLogin('');

    expect(consoleErrorSpy).toHaveBeenCalledWith('NEXT_PUBLIC_GITHUB_CLIENT_ID is not defined');
    expect(window.location.href).toBe('http://localhost:3000');
  });

  it('should handle special characters in client ID', () => {
    const clientId = 'test-client-id-123';
    handleGitHubLogin(clientId);

    expect(window.location.href).toContain(`client_id=${clientId}`);
  });
});

describe('getPlatformBenefits', () => {
  const mockTranslations = {
    login: {
      benefit1: 'Deploy in seconds with Git integration',
      benefit2: 'Hosted 100% in Switzerland',
      benefit3: 'Enterprise-grade security & privacy',
    },
  };

  it('should return an array of 3 benefits', () => {
    const benefits = getPlatformBenefits(mockTranslations);
    expect(benefits).toHaveLength(3);
  });

  it('should return benefits with correct structure', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    benefits.forEach((benefit) => {
      expect(benefit).toHaveProperty('id');
      expect(benefit).toHaveProperty('icon');
      expect(benefit).toHaveProperty('text');
      expect(typeof benefit.id).toBe('string');
      expect(typeof benefit.text).toBe('string');
    });
  });

  it('should return benefits with correct IDs in order', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    expect(benefits[0].id).toBe('deploy-git');
    expect(benefits[1].id).toBe('hosted-switzerland');
    expect(benefits[2].id).toBe('enterprise-security');
  });

  it('should map translation texts correctly', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    expect(benefits[0].text).toBe('Deploy in seconds with Git integration');
    expect(benefits[1].text).toBe('Hosted 100% in Switzerland');
    expect(benefits[2].text).toBe('Enterprise-grade security & privacy');
  });

  it('should return benefits with JSX icon elements', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    benefits.forEach((benefit) => {
      expect(benefit.icon).toBeTruthy();
      expect(benefit.icon).toHaveProperty('type');
      expect(benefit.icon).toHaveProperty('props');
    });
  });

  it('should include correct icon classes', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    expect(benefits[0].icon.props.className).toBe('text-indigo-400');
    expect(benefits[1].icon.props.className).toBe('text-emerald-400');
    expect(benefits[2].icon.props.className).toBe('text-blue-400');
  });

  it('should include correct icon sizes', () => {
    const benefits = getPlatformBenefits(mockTranslations);

    benefits.forEach((benefit) => {
      expect(benefit.icon.props.size).toBe(18);
    });
  });

  it('should handle different translation values', () => {
    const customTranslations = {
      login: {
        benefit1: 'Custom benefit 1',
        benefit2: 'Custom benefit 2',
        benefit3: 'Custom benefit 3',
      },
    };

    const benefits = getPlatformBenefits(customTranslations);

    expect(benefits[0].text).toBe('Custom benefit 1');
    expect(benefits[1].text).toBe('Custom benefit 2');
    expect(benefits[2].text).toBe('Custom benefit 3');
  });

  it('should maintain consistent structure across different translations', () => {
    const translations1 = {
      login: {
        benefit1: 'Benefit A',
        benefit2: 'Benefit B',
        benefit3: 'Benefit C',
      },
    };

    const translations2 = {
      login: {
        benefit1: 'Vorteil A',
        benefit2: 'Vorteil B',
        benefit3: 'Vorteil C',
      },
    };

    const benefits1 = getPlatformBenefits(translations1);
    const benefits2 = getPlatformBenefits(translations2);

    expect(benefits1.map((b) => b.id)).toEqual(benefits2.map((b) => b.id));
    expect(benefits1.map((b) => b.icon.props.className)).toEqual(
      benefits2.map((b) => b.icon.props.className),
    );
  });
});
