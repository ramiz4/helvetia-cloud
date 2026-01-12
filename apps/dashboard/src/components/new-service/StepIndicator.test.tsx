import { useLanguage } from '@/lib/LanguageContext';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepIndicator from './StepIndicator';

vi.mock('@/lib/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

const mockTranslations = {
  dashboard: {
    newService: {
      step1: 'Step 1 Name',
      step2: 'Step 2 Name',
      step3: 'Step 3 Name',
    },
  },
};

describe('StepIndicator', () => {
  it('renders all steps with correct titles', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLanguage).mockReturnValue({ t: mockTranslations } as any);
    render(<StepIndicator step={1} onStepClick={() => {}} />);

    expect(screen.getByText('Step 1 Name')).toBeDefined();
    expect(screen.getByText('Step 2 Name')).toBeDefined();
    expect(screen.getByText('Step 3 Name')).toBeDefined();
  });

  it('calls onStepClick when a clickable step is clicked', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLanguage).mockReturnValue({ t: mockTranslations } as any);
    const onStepClick = vi.fn();
    render(<StepIndicator step={2} onStepClick={onStepClick} />);

    fireEvent.click(screen.getByText('Step 1 Name'));
    expect(onStepClick).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Step 2 Name'));
    expect(onStepClick).toHaveBeenCalledWith(2);
  });

  it('disables future steps and prevents click', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLanguage).mockReturnValue({ t: mockTranslations } as any);
    const onStepClick = vi.fn();
    render(<StepIndicator step={1} onStepClick={onStepClick} />);

    const step2Button = screen.getByText('Step 2 Name').closest('button');
    expect(step2Button).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByText('Step 2 Name'));
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('highlights current step', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useLanguage).mockReturnValue({ t: mockTranslations } as any);
    const { container } = render(<StepIndicator step={2} onStepClick={() => {}} />);

    // Check if step 2 has the active background class
    const buttons = container.querySelectorAll('button');
    expect(buttons[1].className).toContain('bg-indigo-500/10');
    expect(buttons[0].className).not.toContain('bg-indigo-500/10');
    expect(buttons[2].className).not.toContain('bg-indigo-500/10');
  });
});
