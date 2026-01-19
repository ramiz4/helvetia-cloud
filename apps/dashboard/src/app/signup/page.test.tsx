import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from 'shared-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import SignupPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
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

describe('SignupPage', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    vi.clearAllMocks();
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000/signup',
      origin: 'http://localhost:3000',
    } as string & Location;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  const renderSignupPage = () => {
    return render(
      <LanguageProvider>
        <SignupPage />
      </LanguageProvider>,
    );
  };

  it('renders signup page with heading', async () => {
    renderSignupPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/create an account/i)).toBeInTheDocument();
    });
  });

  it('displays form fields', async () => {
    renderSignupPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });
  });

  it('has link to login page', async () => {
    renderSignupPage();
    await waitFor(() => {
      const loginLink = screen.getByRole('link', { name: /already have an account\? sign in/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  it('displays GitHub login button', async () => {
    renderSignupPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with github/i })).toBeInTheDocument();
    });
  });

  it('has no accessibility violations', async () => {
    const { container } = renderSignupPage();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    // Tab to skip link
    await user.tab();
    expect(screen.getByText(/skip to signup form/i)).toHaveFocus();

    // Tab to home link
    await user.tab();
    expect(screen.getByRole('link', { name: /back to home page/i })).toHaveFocus();

    // Tab to username input
    await user.tab();
    expect(screen.getByLabelText(/username/i)).toHaveFocus();

    // Tab to email input
    await user.tab();
    expect(screen.getByLabelText(/^email$/i)).toHaveFocus();

    // Tab to password input
    await user.tab();
    expect(screen.getByLabelText(/^password$/i)).toHaveFocus();

    // Tab to confirm password input
    await user.tab();
    expect(screen.getByLabelText(/confirm password/i)).toHaveFocus();
  });
});
