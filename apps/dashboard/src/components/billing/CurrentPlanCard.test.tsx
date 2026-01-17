import type { Subscription } from '@/types/billing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurrentPlanCard } from './CurrentPlanCard';

describe('CurrentPlanCard', () => {
  const mockSubscription: Subscription = {
    id: 'sub_123',
    plan: 'PRO',
    status: 'ACTIVE',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_stripe_123',
    currentPeriodStart: '2024-01-01T00:00:00Z',
    currentPeriodEnd: '2024-02-01T00:00:00Z',
  };

  const mockOnManage = () => {};

  it('should render subscription details correctly', () => {
    render(<CurrentPlanCard subscription={mockSubscription} onManage={mockOnManage} />);

    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('should display formatted dates', () => {
    render(<CurrentPlanCard subscription={mockSubscription} onManage={mockOnManage} />);

    expect(screen.getByText(/Jan 1, 2024 - Feb 1, 2024/)).toBeInTheDocument();
  });

  it('should render "Manage Subscription" button by default', () => {
    render(<CurrentPlanCard subscription={mockSubscription} onManage={mockOnManage} />);

    expect(screen.getByRole('button', { name: 'Manage Subscription' })).toBeInTheDocument();
  });

  it('should render "Loading..." button when loading', () => {
    render(<CurrentPlanCard subscription={mockSubscription} onManage={mockOnManage} loading />);

    expect(screen.getByRole('button', { name: 'Loading...' })).toBeInTheDocument();
  });

  it('should show correct status color for ACTIVE status', () => {
    render(<CurrentPlanCard subscription={mockSubscription} onManage={mockOnManage} />);

    const statusBadge = screen.getByText('ACTIVE');
    expect(statusBadge).toHaveClass('text-emerald-400');
  });

  it('should show correct status color for PAST_DUE status', () => {
    const pastDueSubscription = { ...mockSubscription, status: 'PAST_DUE' as const };
    render(<CurrentPlanCard subscription={pastDueSubscription} onManage={mockOnManage} />);

    const statusBadge = screen.getByText('PAST_DUE');
    expect(statusBadge).toHaveClass('text-amber-400');
  });

  it('should show correct status color for CANCELED status', () => {
    const canceledSubscription = { ...mockSubscription, status: 'CANCELED' as const };
    render(<CurrentPlanCard subscription={canceledSubscription} onManage={mockOnManage} />);

    const statusBadge = screen.getByText('CANCELED');
    expect(statusBadge).toHaveClass('text-slate-400');
  });
});
