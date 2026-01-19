// @vitest-environment jsdom
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
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
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
    API_BASE_URL: 'http://localhost:3001',
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('LoginPage', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    vi.clearAllMocks();
    // Mock window.location
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000/login',
      origin: 'http://localhost:3000',
    } as string & Location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
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
      expect(screen.getAllByRole('heading', { level: 1 })[0]).toBeInTheDocument();
    });
  });

  it('displays GitHub login button', async () => {
    renderLoginPage();
    await waitFor(() => {
      const button = screen.getAllByRole('button', { name: /sign in with github/i })[0];
      expect(button).toBeInTheDocument();
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
      const homeLink = screen.getAllByRole('link', { name: /back to home/i })[0];
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
      expect(
        screen.getAllByRole('button', { name: /sign in with github/i })[0],
      ).toBeInTheDocument();
    });

    const loginButton = screen.getAllByRole('button', { name: /sign in with github/i })[0];
    await user.click(loginButton);

    // Check that window.location.href was set to GitHub OAuth URL
    await waitFor(() => {
      expect(window.location.href).toContain('github.com/login/oauth/authorize');
      expect(window.location.href).toContain('client_id=test-client-id');
      expect(window.location.href).toContain('redirect_uri=http://localhost:3000/auth/callback');
    });
  });

  it('displays error message when error param is present', async () => {
    const { useSearchParams } = await import('next/navigation');
    vi.mocked(useSearchParams).mockReturnValue({
      get: vi.fn((key: string) => (key === 'error' ? 'Authentication failed' : null)),
    } as unknown as ReturnType<typeof useSearchParams>);

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
    } as unknown as ReturnType<typeof useSearchParams>);

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
        expect(screen.getAllByRole('heading', { level: 1 })[0]).toBeInTheDocument();
      });
      const results = await axe(container, {
        rules: {
          'landmark-unique': { enabled: false },
          'landmark-no-duplicate-contentinfo': { enabled: false },
          'heading-order': { enabled: false },
          'page-has-heading-one': { enabled: false },
        },
      });
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
        const button = screen.getAllByRole('button', { name: /sign in with github/i })[0];
        expect(button).toHaveAttribute('aria-label', 'Sign in with GitHub');
      });
    });

    it('has proper ARIA labels on links', async () => {
      renderLoginPage();
      await waitFor(() => {
        const homeLink = screen.getAllByRole('link', { name: /back to home page/i })[0];
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
      } as unknown as ReturnType<typeof useSearchParams>);

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
        expect(screen.getAllByRole('heading', { level: 1 })[0]).toBeInTheDocument();
      });

      // Tab to skip link first (correct accessibility behavior)
      await user.tab();
      const skipLink = screen.getByText(/skip to login form/i);
      expect(skipLink).toHaveFocus();

      // Tab to home link
      await user.tab();
      const homeLink = screen.getAllByRole('link', { name: /back to home page/i })[0];
      expect(homeLink).toHaveFocus();

      // Tab to email input
      await user.tab();
      const emailInput = screen.getByPlaceholderText(/you@example.com/i);
      expect(emailInput).toHaveFocus();

      // Tab to password input
      await user.tab();
      const passwordInput = screen.getAllByPlaceholderText(/••••••••/i)[0];
      expect(passwordInput).toHaveFocus();

      // Tab to submit button
      await user.tab();
      const submitButton = screen.getByRole('button', { name: /^sign in$/i });
      expect(submitButton).toHaveFocus();

      // Tab to signup link
      await user.tab();
      const signupLink = screen.getByRole('link', {
        name: /don't have an account\? sign up/i,
      });
      expect(signupLink).toHaveFocus();

      // Tab to GitHub button
      await user.tab();
      const githubButton = screen.getAllByRole('button', { name: /sign in with github/i })[0];
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
        expect(screen.getAllByRole('heading', { level: 1 })[0]).toBeInTheDocument();
      });

      // All content should still be visible
      expect(
        screen.getAllByRole('button', { name: /sign in with github/i })[0],
      ).toBeInTheDocument();
    });
  });
});
