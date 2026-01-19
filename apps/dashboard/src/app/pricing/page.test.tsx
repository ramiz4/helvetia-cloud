// @vitest-environment jsdom
import { useSubscription } from '@/hooks/useBilling';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { LanguageProvider, checkAndRefreshToken } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PricingPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

// Mock useBilling hooks
vi.mock('@/hooks/useBilling', () => ({
  useSubscription: vi.fn(),
}));

// Mock shared-ui
vi.mock('shared-ui', async () => {
  const actual = await vi.importActual('shared-ui');
  return {
    ...actual,
    checkAndRefreshToken: vi.fn(),
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('PricingPage', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
    (useSubscription as any).mockReturnValue({ data: null });
    (checkAndRefreshToken as any).mockResolvedValue(false);

    // Clear localStorage
    localStorage.clear();
  });

  const renderPricingPage = () => {
    return render(
      <LanguageProvider>
        <PricingPage />
      </LanguageProvider>,
    );
  };

  it('renders the pricing page with main heading', () => {
    renderPricingPage();
    expect(screen.getByText(/Simple, Transparent/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing/i)).toBeInTheDocument();
  });

  it('renders available plans', () => {
    renderPricingPage();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated user selects a plan', async () => {
    renderPricingPage();

    const selectButtons = screen.getAllByRole('button', { name: 'Select Plan' });
    fireEvent.click(selectButtons[0]);

    expect(toast.error).toHaveBeenCalledWith('Please login or sign up to select a plan.');
    expect(mockPush).toHaveBeenCalledWith('/login?callbackUrl=/billing');
  });

  it('redirects to billing when authenticated user selects a plan', async () => {
    // Mock authenticated state
    localStorage.setItem('user', JSON.stringify({ id: '123' }));
    (checkAndRefreshToken as any).mockResolvedValue(true);

    renderPricingPage();

    // Wait for the auth check to complete
    await waitFor(() => {
      expect(checkAndRefreshToken).toHaveBeenCalled();
    });

    const selectButtons = screen.getAllByRole('button', { name: 'Select Plan' });
    fireEvent.click(selectButtons[0]);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/billing');
    });
  });

  it('highlights the current user plan if authenticated', async () => {
    localStorage.setItem('user', JSON.stringify({ id: '123' }));
    (checkAndRefreshToken as any).mockResolvedValue(true);
    (useSubscription as any).mockReturnValue({ data: { plan: 'PRO' } });

    renderPricingPage();

    await waitFor(() => {
      const currentPlanBadge = screen.getAllByText('Current Plan');
      expect(currentPlanBadge.length).toBeGreaterThan(0);
    });
  });

  it('renders the custom solution section', () => {
    renderPricingPage();
    expect(screen.getByText(/Need something custom\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contact Sales/i })).toBeInTheDocument();
  });
});
