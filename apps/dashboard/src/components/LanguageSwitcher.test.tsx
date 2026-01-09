import { LanguageProvider } from '@/lib/LanguageContext';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LanguageSwitcher from './LanguageSwitcher';

describe('LanguageSwitcher', () => {
  const renderSwitcher = (variant: 'dropdown' | 'minimal' = 'dropdown') => {
    return render(
      <LanguageProvider>
        <LanguageSwitcher variant={variant} />
      </LanguageProvider>,
    );
  };

  it('renders dropdown variant by default', () => {
    renderSwitcher();
    // Should show the globe icon and current language short code
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.queryByText('Deutsch')).not.toBeInTheDocument();
  });

  it('opens dropdown menu on click', () => {
    renderSwitcher('dropdown');
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Now languages should be visible
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
  });

  it('renders minimal variant as button list', () => {
    renderSwitcher('minimal');
    // In minimal variant, all language codes are rendered directly
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('DE')).toBeInTheDocument();
    expect(screen.getByText('CH')).toBeInTheDocument();
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('IT')).toBeInTheDocument();
  });

  it('changes language when a button is clicked in minimal variant', () => {
    renderSwitcher('minimal');
    const deButton = screen.getByText('DE');
    fireEvent.click(deButton);

    // The button should now have the active class (text-indigo-400)
    expect(deButton).toHaveClass('text-indigo-400');
  });
});
