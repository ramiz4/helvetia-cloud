import type { Usage } from '@/types/billing';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UsageMetrics } from './UsageMetrics';

describe('UsageMetrics', () => {
  const mockUsage: Usage = {
    usage: [
      { metric: 'COMPUTE_HOURS', quantity: 10.5, cost: 5.25 },
      { metric: 'MEMORY_GB_HOURS', quantity: 50.0, cost: 10.0 },
      { metric: 'BANDWIDTH_GB', quantity: 100.25, cost: 15.5 },
      { metric: 'STORAGE_GB', quantity: 25.75, cost: 8.0 },
    ],
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-02-01T00:00:00Z',
  };

  it('should render usage metrics title and period', () => {
    render(<UsageMetrics usage={mockUsage} />);

    expect(screen.getByText('Usage Metrics')).toBeInTheDocument();
    expect(screen.getByText(/Jan 1 - Feb 1/)).toBeInTheDocument();
  });

  it('should render all usage metrics', () => {
    render(<UsageMetrics usage={mockUsage} />);

    expect(screen.getByText('Compute Hours')).toBeInTheDocument();
    expect(screen.getByText('Memory (GB·hours)')).toBeInTheDocument();
    expect(screen.getByText('Bandwidth (GB)')).toBeInTheDocument();
    expect(screen.getByText('Storage (GB)')).toBeInTheDocument();
  });

  it('should render correct quantities', () => {
    render(<UsageMetrics usage={mockUsage} />);

    expect(screen.getByText('10.5')).toBeInTheDocument();
    expect(screen.getByText('50.0')).toBeInTheDocument();
    expect(screen.getByText('100.25')).toBeInTheDocument();
    expect(screen.getByText('25.75')).toBeInTheDocument();
  });

  it('should render correct costs', () => {
    render(<UsageMetrics usage={mockUsage} />);

    expect(screen.getByText('$5.25')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$15.50')).toBeInTheDocument();
    expect(screen.getByText('$8.00')).toBeInTheDocument();
  });

  it('should show "No usage data" message when usage is empty', () => {
    const emptyUsage: Usage = {
      usage: [],
      periodStart: '2024-01-01T00:00:00Z',
      periodEnd: '2024-02-01T00:00:00Z',
    };

    render(<UsageMetrics usage={emptyUsage} />);

    expect(screen.getByText('No usage data available for this period')).toBeInTheDocument();
  });
});
