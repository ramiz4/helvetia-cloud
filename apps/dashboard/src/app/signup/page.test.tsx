import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageProvider } from 'shared-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import SignupPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
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

// Mock global fetch
global.fetch = vi.fn();

describe('SignupPage', () => {
  let originalLocation: Location;
  let mockPush: ReturnType<typeof vi.fn>;
  let mockToast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    originalLocation = window.location;
    vi.clearAllMocks();
    delete (window as { location?: Location }).location;
    window.location = {
      ...originalLocation,
      href: 'http://localhost:3000/signup',
      origin: 'http://localhost:3000',
    } as string & Location;
    
    // Reset localStorage
    localStorage.clear();
    
    // Get mocked functions
    const { useRouter } = await import('next/navigation');
    const toast = (await import('react-hot-toast')).default;
    mockPush = useRouter().push as ReturnType<typeof vi.fn>;
    mockToast = toast as unknown as { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
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

  describe('Form Validation', () => {
    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form with non-matching passwords
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentpassword');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that error toast was shown
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Passwords do not match');
      });
    });

    it('shows error when password is too short', async () => {
      const user = userEvent.setup();
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form with short password
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'short');
      await user.type(confirmPasswordInput, 'short');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that error toast was shown
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Password must be at least 8 characters');
      });
    });

    it('shows error when username is too short', async () => {
      const user = userEvent.setup();
      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form with short username
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'ab');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that error toast was shown
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Username must be at least 3 characters');
      });
    });
  });

  describe('Form Submission', () => {
    it('successfully registers a user', async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          user: { id: '1', email: 'test@example.com', username: 'testuser' },
        }),
      } as Response);

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form with valid data
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that fetch was called with correct data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3001/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'password123',
              username: 'testuser',
            }),
            credentials: 'include',
          }),
        );
      });

      // Check that success toast was shown
      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Account created successfully!');
      });

      // Check that data was stored
      expect(localStorage.getItem('token')).toBe('test-token');
      expect(localStorage.getItem('user')).toBe(
        JSON.stringify({ id: '1', email: 'test@example.com', username: 'testuser' }),
      );
    });

    it('shows loading state during registration', async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      // Mock a slow response
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    token: 'test-token',
                    user: { id: '1', email: 'test@example.com', username: 'testuser' },
                  }),
                } as Response),
              100,
            ),
          ),
      );

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that loading state is shown
      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });

      // Wait for completion
      await waitFor(
        () => {
          expect(mockToast.success).toHaveBeenCalled();
        },
        { timeout: 1000 },
      );
    });

    it('handles registration API error', async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Email already exists' }),
      } as Response);

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that error toast was shown
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Email already exists');
      });
    });

    it('handles network error', async () => {
      const user = userEvent.setup();
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      renderSignupPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      });

      // Fill in form
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/^email$/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create account/i });
      await user.click(submitButton);

      // Check that generic error toast was shown
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
      });
    });
  });
});
