import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsCards } from './StatsCards';

describe('StatsCards', () => {
  const mockTranslations = {
    stats: {
      total: 'Total Services',
      active: 'Active',
      failed: 'Failed',
    },
  };

  it('renders all stats correctly', () => {
    render(
      <StatsCards
        totalServices={10}
        activeServices={7}
        failedServices={1}
        translations={mockTranslations}
      />,
    );

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Total Services')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders zero stats correctly', () => {
    render(
      <StatsCards
        totalServices={0}
        activeServices={0}
        failedServices={0}
        translations={mockTranslations}
      />,
    );

    const zeroElements = screen.getAllByText('0');
    expect(zeroElements).toHaveLength(3);
  });
});
