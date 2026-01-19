import { PLANS } from '@/lib/plans';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvailablePlans } from './AvailablePlans';

describe('AvailablePlans', () => {
  const mockOnSelect = vi.fn();

  it('should render all plans', () => {
    render(<AvailablePlans onSelect={mockOnSelect} />);

    PLANS.forEach((plan) => {
      expect(screen.getByText(plan.displayName)).toBeInTheDocument();
    });
  });

  it('should highlight the current plan', () => {
    render(<AvailablePlans currentPlan="PRO" onSelect={mockOnSelect} />);

    // Get the PlanCard for PRO
    const proPlanButton = screen.getByRole('button', { name: 'Current Plan' });
    expect(proPlanButton).toBeInTheDocument();
    expect(proPlanButton).toBeDisabled();
  });

  it('should call onSelect when a plan is selected', () => {
    render(<AvailablePlans onSelect={mockOnSelect} />);

    // Get all "Select Plan" buttons
    const selectButtons = screen.getAllByRole('button', { name: 'Select Plan' });
    fireEvent.click(selectButtons[0]);

    expect(mockOnSelect).toHaveBeenCalled();
  });

  it('should show loading state on buttons when isLoading is true', () => {
    render(<AvailablePlans onSelect={mockOnSelect} isLoading={true} />);

    const loadingButtons = screen.getAllByText('Processing...');
    expect(loadingButtons.length).toBeGreaterThan(0);
  });
});
