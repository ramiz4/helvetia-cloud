import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('renders with placeholder', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Search services..." />);

    expect(screen.getByPlaceholderText('Search services...')).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(<SearchBar value="test query" onChange={() => {}} placeholder="Search services..." />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test query');
  });

  it('calls onChange when typing', () => {
    const handleChange = vi.fn();
    render(<SearchBar value="" onChange={handleChange} placeholder="Search services..." />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new search' } });

    expect(handleChange).toHaveBeenCalledWith('new search');
  });

  it('renders search icon', () => {
    const { container } = render(
      <SearchBar value="" onChange={() => {}} placeholder="Search services..." />,
    );

    // Check for the SVG icon (Lucide icons render as SVGs)
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
