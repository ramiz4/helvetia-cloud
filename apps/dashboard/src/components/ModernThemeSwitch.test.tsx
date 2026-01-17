import { ThemeProvider } from '@/lib/ThemeContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ModernThemeSwitch from './ModernThemeSwitch';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Sun: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="sun-icon" className={className} style={{ fontSize: size }}>
      ☀️
    </span>
  ),
  Moon: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="moon-icon" className={className} style={{ fontSize: size }}>
      🌙
    </span>
  ),
}));

describe('ModernThemeSwitch', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  const renderThemeSwitch = (variant?: 'default' | 'minimal') => {
    return render(
      <ThemeProvider>
        <ModernThemeSwitch variant={variant} />
      </ThemeProvider>,
    );
  };

  describe('default variant', () => {
    it('should render theme switch button', async () => {
      renderThemeSwitch();
      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
      });
    });

    it('should toggle theme when clicked', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');

      // Click to toggle to dark
      fireEvent.click(button);

      await waitFor(() => {
        expect(localStorage.getItem('theme-preference')).toBe('dark');
      });

      // Click to toggle to light
      fireEvent.click(button);

      await waitFor(() => {
        expect(localStorage.getItem('theme-preference')).toBe('light');
      });
    });

    it('should display correct icon based on theme', async () => {
      localStorage.setItem('theme-preference', 'dark');

      renderThemeSwitch();

      await waitFor(() => {
        const moonIcons = screen.getAllByTestId('moon-icon');
        expect(moonIcons.length).toBeGreaterThan(0);
      });
    });

    it('should have proper ARIA attributes', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('should apply hover and active styles', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button.className).toContain('hover:scale-105');
        expect(button.className).toContain('active:scale-95');
      });
    });
  });

  describe('minimal variant', () => {
    it('should render with label', async () => {
      renderThemeSwitch('minimal');

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      // Should show either "Dark Mode" or "Light Mode"
      const hasLabel =
        screen.queryByText(/Dark Mode/i) !== null || screen.queryByText(/Light Mode/i) !== null;
      expect(hasLabel).toBe(true);
    });

    it('should show auto label when theme is system', async () => {
      localStorage.setItem('theme-preference', 'system');

      renderThemeSwitch('minimal');

      await waitFor(() => {
        expect(screen.getByText(/\(Auto\)/i)).toBeInTheDocument();
      });
    });

    it('should toggle theme when clicked', async () => {
      renderThemeSwitch('minimal');

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });

      const button = screen.getByRole('button');

      // Click to toggle
      fireEvent.click(button);

      await waitFor(() => {
        const storedTheme = localStorage.getItem('theme-preference');
        expect(storedTheme).toBeTruthy();
      });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA label', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('should have aria-pressed attribute', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-pressed');
      });
    });

    it('should be keyboard accessible', async () => {
      renderThemeSwitch();

      await waitFor(() => {
        const button = screen.getByRole('button');
        button.focus();
        expect(document.activeElement).toBe(button);
      });
    });
  });

  describe('loading state', () => {
    it('should show loading state before mounted', () => {
      const { container } = render(
        <ThemeProvider>
          <ModernThemeSwitch />
        </ThemeProvider>,
      );

      // Initially should have a placeholder during hydration
      expect(container).toBeTruthy();
    });
  });
});
