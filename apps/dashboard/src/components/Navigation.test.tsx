import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Navigation from './Navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock Image component
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

vi.mock('@/lib/OrganizationContext', () => ({
  useOrganizationContext: () => ({
    currentOrganization: { id: 'org1', name: 'Org 1' },
    setCurrentOrganization: vi.fn(),
    organizations: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useOrganizations', () => ({
  useOrganizations: () => ({
    data: [{ id: 'org1', name: 'Org 1' }],
    isLoading: false,
  }),
}));

describe('Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset body style overflow
    document.body.style.overflow = 'unset';
  });

  const renderNav = () => {
    return render(
      <LanguageProvider>
        <Navigation />
      </LanguageProvider>,
    );
  };

  it('renders brand name and login button when logged out', () => {
    renderNav();
    expect(screen.getByText(/HELVETIA/i)).toBeInTheDocument();
    // Desktop login button
    expect(screen.getAllByText(/login/i)[0]).toBeInTheDocument();
  });

  it('renders dashboard and user menu when logged in', async () => {
    localStorage.setItem('user', JSON.stringify({ username: 'testuser' }));

    renderNav();

    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });

  it('toggles mobile menu when hamburger button is clicked', async () => {
    // Set viewport to mobile is hard in JSDOM, better to just check if button exists and triggers state
    renderNav();

    const toggleButton = screen.getByLabelText(/open navigation menu/i);
    fireEvent.click(toggleButton);

    // After clicking, the "minimal" language switcher should be visible in the overlay.
    // There will be multiple "EN" buttons now (desktop hidden and mobile unique).
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0);

    // Close button (X) should be visible (we can check for the button or its change)
    expect(screen.getByLabelText(/close navigation menu/i)).toBeInTheDocument();
  });

  it('closes mobile menu on route change', async () => {
    const { rerender } = renderNav();

    const toggleButton = screen.getByLabelText(/open navigation menu/i);
    fireEvent.click(toggleButton);

    // Mock pathname change
    const { usePathname } = await import('next/navigation');
    vi.mocked(usePathname).mockReturnValue('/deployments');

    rerender(
      <LanguageProvider>
        <Navigation />
      </LanguageProvider>,
    );

    // Minimal lang switcher (only in mobile menu) should be gone if menu is closed
    // Note: We need to be careful with how we detect if it's closed.
    // In our implementation, isMenuOpen becomes false.
    await waitFor(() => {
      // The overlay should be removed from DOM
      expect(screen.queryByText('DE')).toBeNull();
    });
  });
});
