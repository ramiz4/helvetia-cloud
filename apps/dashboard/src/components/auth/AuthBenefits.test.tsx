// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthBenefits, Benefit } from './AuthBenefits';

describe('AuthBenefits', () => {
  const mockBenefits: Benefit[] = [
    {
      id: '1',
      icon: <span data-testid="icon-1">Icon 1</span>,
      text: 'Benefit 1: Description 1',
    },
    {
      id: '2',
      icon: <span data-testid="icon-2">Icon 2</span>,
      text: 'Benefit 2',
    },
  ];

  it('renders a list of benefits', () => {
    render(<AuthBenefits benefits={mockBenefits} />);

    // Check list role
    expect(screen.getByRole('list')).toBeInTheDocument();

    // Check list items
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('displays benefit text correctly', () => {
    render(<AuthBenefits benefits={mockBenefits} />);

    // Check titles (derived from text before :)
    expect(screen.getByText('Benefit 1')).toBeInTheDocument();
    // "Benefit 2" appears twice: once as the title and once as the description
    const benefit2Elements = screen.getAllByText('Benefit 2');
    expect(benefit2Elements).toHaveLength(2);

    // Check descriptions (text after : if present, or full text if no :)
    expect(screen.getByText('Description 1')).toBeInTheDocument();
  });

  it('renders icons for each benefit', () => {
    render(<AuthBenefits benefits={mockBenefits} />);

    expect(screen.getByTestId('icon-1')).toBeInTheDocument();
    expect(screen.getByTestId('icon-2')).toBeInTheDocument();
  });
});
