import { TranslationType, useLanguage } from 'shared-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepIndicator from './StepIndicator';

// Import the real translations
import en from 'shared-ui/locales/en.json';

// Cast the imported JSON to the strict TranslationType
// This is necessary because 'en' is inferred as string types, but TranslationType expects exact string literals (as const)
const mockT = en as unknown as TranslationType;

vi.mock('shared-ui', async () => {
  const actual = await vi.importActual('shared-ui');
  return {
    ...actual,
    useLanguage: vi.fn(),
  };
});

const mockSetLanguage = vi.fn();

describe('StepIndicator', () => {
  it('renders all steps with correct titles', () => {
    vi.mocked(useLanguage).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      t: mockT,
    });
    render(<StepIndicator step={1} onStepClick={() => {}} />);

    expect(screen.getByText(mockT.dashboard.newService.step1)).toBeDefined();
    expect(screen.getByText(mockT.dashboard.newService.step2)).toBeDefined();
    expect(screen.getByText(mockT.dashboard.newService.step3)).toBeDefined();
  });

  it('calls onStepClick when a clickable step is clicked', () => {
    vi.mocked(useLanguage).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      t: mockT,
    });
    const onStepClick = vi.fn();
    render(<StepIndicator step={2} onStepClick={onStepClick} />);

    fireEvent.click(screen.getByText(mockT.dashboard.newService.step1));
    expect(onStepClick).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText(mockT.dashboard.newService.step2));
    expect(onStepClick).toHaveBeenCalledWith(2);
  });

  it('disables future steps and prevents click', () => {
    vi.mocked(useLanguage).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      t: mockT,
    });
    const onStepClick = vi.fn();
    render(<StepIndicator step={1} onStepClick={onStepClick} />);

    // Since step 2 is disabled, use closest button to check disabled prop or query by text
    const step2Button = screen.getByText(mockT.dashboard.newService.step2).closest('button');
    expect(step2Button).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByText(mockT.dashboard.newService.step2));
    expect(onStepClick).not.toHaveBeenCalled();
  });

  it('highlights current step', () => {
    vi.mocked(useLanguage).mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      t: mockT,
    });
    const { container } = render(<StepIndicator step={2} onStepClick={() => {}} />);

    // Check if step 2 has the active background class
    const buttons = container.querySelectorAll('button');
    expect(buttons[1].className).toContain('bg-indigo-500/10');
    expect(buttons[0].className).not.toContain('bg-indigo-500/10');
    expect(buttons[2].className).not.toContain('bg-indigo-500/10');
  });
});
