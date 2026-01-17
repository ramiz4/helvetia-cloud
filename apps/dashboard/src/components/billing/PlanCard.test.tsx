import type { PlanDetails } from '@/types/billing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanCard } from './PlanCard';

describe('PlanCard', () => {
  const mockPlan: PlanDetails = {
    name: 'PRO',
    displayName: 'Pro',
    price: 99,
    interval: 'month',
    priceId: 'price_123',
    features: ['Feature 1', 'Feature 2', 'Feature 3'],
    highlighted: false,
  };

  const mockOnSelect = () => {};

  it('should render plan details correctly', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} />);

    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('$99')).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
    expect(screen.getByText('Feature 3')).toBeInTheDocument();
  });

  it('should show "Popular" badge for highlighted plan', () => {
    const highlightedPlan = { ...mockPlan, highlighted: true };
    render(<PlanCard plan={highlightedPlan} onSelect={mockOnSelect} />);

    expect(screen.getByText('Popular')).toBeInTheDocument();
  });

  it('should show "Current Plan" badge when plan is current', () => {
    render(<PlanCard plan={mockPlan} currentPlan="PRO" onSelect={mockOnSelect} />);

    const badges = screen.getAllByText('Current Plan');
    expect(badges.length).toBeGreaterThan(0);
    // Check that the badge element (div) exists
    expect(badges[0].tagName).toBe('DIV');
  });

  it('should render "Select Plan" button by default', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} />);

    expect(screen.getByRole('button', { name: 'Select Plan' })).toBeInTheDocument();
  });

  it('should render "Current Plan" button when plan is current', () => {
    render(<PlanCard plan={mockPlan} currentPlan="PRO" onSelect={mockOnSelect} />);

    const button = screen.getByRole('button', { name: 'Current Plan' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('should render "Processing..." button when loading', () => {
    render(<PlanCard plan={mockPlan} onSelect={mockOnSelect} loading />);

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeInTheDocument();
  });
});
