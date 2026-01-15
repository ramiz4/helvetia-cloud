import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage } from '../LanguageContext';

// Test component that uses the language context
function TestComponent() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <div data-testid="current-language">{language}</div>
      <button onClick={() => setLanguage('de')}>Switch to German</button>
      <div data-testid="translation">{t.common?.loading || 'Loading...'}</div>
    </div>
  );
}

describe('LanguageContext', () => {
  it('should provide default language as English', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Use findBy to wait for the component to mount (as it initially returns null)
    const element = await screen.findByTestId('current-language');
    expect(element.textContent).toBe('en');
  });

  it('should provide translations object', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    const translation = await screen.findByTestId('translation');
    expect(translation).toBeDefined();
  });

  it('should allow language switching', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for mount
    const button = await screen.findByText('Switch to German');

    // fireEvent wraps the action in act()
    fireEvent.click(button);

    // Language should be updated
    const element = screen.getByTestId('current-language');
    expect(element.textContent).toBe('de');
  });
});
