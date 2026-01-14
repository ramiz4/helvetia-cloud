import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputWithAction } from './InputWithAction';

describe('InputWithAction', () => {
  it('should render label and input', () => {
    render(<InputWithAction label="Test Label" value="" onChange={vi.fn()} />);

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should display the current value', () => {
    render(<InputWithAction label="Test" value="test value" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test value');
  });

  it('should call onChange when input value changes', () => {
    const handleChange = vi.fn();
    render(<InputWithAction label="Test" value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });

    expect(handleChange).toHaveBeenCalledWith('new value');
  });

  it('should use text type by default', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('should use custom type when provided', () => {
    const { container } = render(
      <InputWithAction label="Test" value="" onChange={vi.fn()} type="password" />,
    );

    const input = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
  });

  it('should display placeholder text', () => {
    render(
      <InputWithAction label="Test" value="" onChange={vi.fn()} placeholder="Enter value here" />,
    );

    const input = screen.getByPlaceholderText('Enter value here');
    expect(input).toBeInTheDocument();
  });

  it('should not render generate button when onGenerate is not provided', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} />);

    expect(screen.queryByTitle('Generate secure value')).not.toBeInTheDocument();
  });

  it('should render generate button when onGenerate is provided', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} onGenerate={vi.fn()} />);

    expect(screen.getByTitle('Generate secure value')).toBeInTheDocument();
  });

  it('should call onGenerate when generate button is clicked', () => {
    const handleGenerate = vi.fn();
    render(
      <InputWithAction label="Test" value="" onChange={vi.fn()} onGenerate={handleGenerate} />,
    );

    const generateButton = screen.getByTitle('Generate secure value');
    fireEvent.click(generateButton);

    expect(handleGenerate).toHaveBeenCalledTimes(1);
  });

  it('should render labelAction when provided', () => {
    const labelAction = <span>Custom Action</span>;
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} labelAction={labelAction} />);

    expect(screen.getByText('Custom Action')).toBeInTheDocument();
  });

  it('should have button type="button" to prevent form submission', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} onGenerate={vi.fn()} />);

    const button = screen.getByTitle('Generate secure value') as HTMLButtonElement;
    expect(button.type).toBe('button');
  });

  it('should display "Auto" text in generate button', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} onGenerate={vi.fn()} />);

    expect(screen.getByText('Auto')).toBeInTheDocument();
  });

  it('should apply correct CSS classes for styling', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox');
    expect(input.className).toContain('bg-slate-900/50');
    expect(input.className).toContain('border');
    expect(input.className).toContain('rounded-xl');
  });

  it('should handle multiple onChange calls', () => {
    const handleChange = vi.fn();
    render(<InputWithAction label="Test" value="" onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'first' } });
    fireEvent.change(input, { target: { value: 'second' } });
    fireEvent.change(input, { target: { value: 'third' } });

    expect(handleChange).toHaveBeenCalledTimes(3);
    expect(handleChange).toHaveBeenNthCalledWith(1, 'first');
    expect(handleChange).toHaveBeenNthCalledWith(2, 'second');
    expect(handleChange).toHaveBeenNthCalledWith(3, 'third');
  });

  it('should handle empty string value', () => {
    render(<InputWithAction label="Test" value="" onChange={vi.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('should handle special characters in value', () => {
    const specialValue = 'test@#$%^&*()_+{}[]|\\:;"<>?,./';
    render(<InputWithAction label="Test" value={specialValue} onChange={vi.fn()} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe(specialValue);
  });
});
