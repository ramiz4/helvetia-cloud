import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { describe, expect, it } from 'vitest';
import Navigation from '../components/Navigation';
import UserMenu from '../components/UserMenu';
import CookieBanner from '../components/CookieBanner';
import { LanguageProvider } from '../lib/LanguageContext';

// Helper to wrap components with LanguageProvider
const renderWithProviders = (component: React.ReactElement) => {
  return render(<LanguageProvider>{component}</LanguageProvider>);
};

describe('Accessibility Tests', () => {
  describe('Navigation Component', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = renderWithProviders(<Navigation />);
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });

  describe('UserMenu Component', () => {
    it('should not have any accessibility violations', async () => {
      const mockUser = {
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      const mockLogout = () => {};

      const { container } = renderWithProviders(
        <UserMenu user={mockUser} onLogout={mockLogout} />,
      );
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });

  describe('CookieBanner Component', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = renderWithProviders(
        <CookieBanner
          title="Cookie Consent"
          text="We use cookies to improve your experience."
          acceptText="Accept"
        />,
      );
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
