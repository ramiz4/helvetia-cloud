import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from 'shared-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import LoginPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn(() => null),
  })),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Mock shared-ui
vi.mock('shared-ui', async () => {
  const actual = await vi.importActual('shared-ui');
  return {
    ...actual,
    GITHUB_CLIENT_ID: 'test-client-id',
  };
});

describe('LoginPage', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000/login',
      origin: 'http://localhost:3000',
    };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  const renderLoginPage = () => {
    return render(
      <LanguageProvider>
        <LoginPage />
      </LanguageProvider>,
    );
  };

  it('renders login page with heading', async () => {
    renderLoginPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('displays platform logo', async () => {
    renderLoginPage();
    await waitFor(() => {
      const logo = screen.getByAltText('Helvetia Cloud Logo');
      expect(logo).toBeInTheDocument();
    });
  });

  it('displays GitHub login button', async () => {
    renderLoginPage();
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /sign in with github/i });
      expect(button).toBeInTheDocument();
    });
  });

  it('displays platform benefits', async () => {
    renderLoginPage();
    await waitFor(() => {
      expect(screen.getByText(/deploy in seconds with git integration/i)).toBeInTheDocument();
      expect(screen.getByText(/hosted 100% in switzerland/i)).toBeInTheDocument();
      expect(screen.getByText(/enterprise-grade security & privacy/i)).toBeInTheDocument();
    });
  });

  it('displays security message', async () => {
    renderLoginPage();
    await waitFor(() => {
      expect(
        screen.getByText(/your data is encrypted and stored in switzerland/i),
      ).toBeInTheDocument();
    });
  });

  it('displays organization access help message', async () => {
    renderLoginPage();
    await waitFor(() => {
      expect(screen.getByText(/deploying from a github organization/i)).toBeInTheDocument();
    });
  });

  it('has link to home page', async () => {
    renderLoginPage();
    await waitFor(() => {
      const homeLink = screen.getByRole('link', { name: /back to home/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  it('has links to terms and privacy', async () => {
    renderLoginPage();
    await waitFor(() => {
      const termsLink = screen.getByRole('link', { name: /terms of service/i });
      const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
      expect(termsLink).toBeInTheDocument();
      expect(privacyLink).toBeInTheDocument();
    });
  });

  it('handles GitHub login button click', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button', { name: /sign in with github/i });
    await user.click(loginButton);

    // Check that window.location.href was set to GitHub OAuth URL
    await waitFor(() => {
      expect(window.location.href).toContain('github.com/login/oauth/authorize');
      expect(window.location.href).toContain('client_id=test-client-id');
      expect(window.location.href).toContain('redirect_uri=http://localhost:3000/auth/callback');
    });
  });

  it('displays loading state when authenticating', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button', { name: /sign in with github/i });
    await user.click(loginButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/authenticating with github/i)).toBeInTheDocument();
    });
  });

  it('displays error message when error param is present', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => (key === 'error' ? 'Authentication failed' : null)),
    } as ReturnType<typeof useSearchParams>);

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/auth error/i)).toBeInTheDocument();
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
    });
  });

  it('displays code expired error when error param is code_expired', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => (key === 'error' ? 'code_expired' : null)),
    } as ReturnType<typeof useSearchParams>);

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/authorization code has expired/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderLoginPage();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it('has skip to main content link', async () => {
      renderLoginPage();
      await waitFor(() => {
        const skipLink = screen.getByText(/skip to login form/i);
        expect(skipLink).toBeInTheDocument();
        expect(skipLink).toHaveAttribute('href', '#login-form');
      });
    });

    it('has proper ARIA labels on main sections', async () => {
      renderLoginPage();
      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: /login form/i })).toBeInTheDocument();
      });
    });

    it('has proper ARIA labels on GitHub button', async () => {
      renderLoginPage();
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /sign in with github/i });
        expect(button).toHaveAttribute('aria-label', 'Sign in with GitHub');
      });
    });

    it('has proper ARIA labels on links', async () => {
      renderLoginPage();
      await waitFor(() => {
        const homeLink = screen.getByRole('link', { name: /back to home page/i });
        expect(homeLink).toHaveAttribute('aria-label', 'Back to home page');

        const termsLink = screen.getByRole('link', { name: /terms of service/i });
        expect(termsLink).toHaveAttribute('aria-label', 'Terms of Service');

        const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
        expect(privacyLink).toHaveAttribute('aria-label', 'Privacy Policy');
      });
    });

    it('has proper role and aria-live for error messages', async () => {
      const { useSearchParams } = await import('next/navigation');
      vi.mocked(useSearchParams).mockReturnValue({
        get: vi.fn((key: string) => (key === 'error' ? 'Test error' : null)),
      } as ReturnType<typeof useSearchParams>);

      renderLoginPage();

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Tab to skip link first (correct accessibility behavior)
      await user.tab();
      const skipLink = screen.getByText(/skip to login form/i);
      expect(skipLink).toHaveFocus();

      // Tab to home link
      await user.tab();
      const homeLink = screen.getByRole('link', { name: /back to home page/i });
      expect(homeLink).toHaveFocus();

      // Tab to GitHub button
      await user.tab();
      const githubButton = screen.getByRole('button', { name: /sign in with github/i });
      expect(githubButton).toHaveFocus();

      // Test Enter key on button
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(window.location.href).toContain('github.com/login/oauth/authorize');
      });
    });
  });

  describe('Responsive Design', () => {
    it('renders correctly on mobile viewport', async () => {
      global.innerWidth = 375;
      global.innerHeight = 667;
      renderLoginPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // All content should still be visible
      expect(screen.getByText(/deploy in seconds/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    });
  });
});
