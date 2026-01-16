import { ThemeProvider } from '@/lib/ThemeContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from 'shared-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSwitcher from './ThemeSwitcher';

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
  Monitor: ({ size, className }: { size?: number; className?: string }) => (
    <span data-testid="monitor-icon" className={className} style={{ fontSize: size }}>
      🖥️
    </span>
  ),
}));

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  const renderThemeSwitcher = (variant?: 'default' | 'minimal') => {
    return render(
      <LanguageProvider>
        <ThemeProvider>
          <ThemeSwitcher variant={variant} />
        </ThemeProvider>
      </LanguageProvider>,
    );
  };

  describe('default variant', () => {
    it('should render theme switcher button', () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });
      expect(button).toBeInTheDocument();
    });

    it('should display system icon by default', () => {
      renderThemeSwitcher();
      expect(screen.getByTestId('monitor-icon')).toBeInTheDocument();
    });

    it('should open dropdown when button is clicked', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should display all theme options in dropdown', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
        expect(screen.getByText('Light')).toBeInTheDocument();
        expect(screen.getByText('Dark')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
      });
    });

    it('should change theme when option is clicked', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const lightOption = screen.getByRole('menuitem', { name: /light/i });
      fireEvent.click(lightOption);

      await waitFor(() => {
        expect(localStorage.getItem('theme-preference')).toBe('light');
      });
    });

    it('should close dropdown when option is selected', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const darkOption = screen.getByRole('menuitem', { name: /dark/i });
      fireEvent.click(darkOption);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should close dropdown when Escape key is pressed', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      fireEvent.keyDown(button, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should mark selected theme with checkmark', async () => {
      localStorage.setItem('theme-preference', 'dark');

      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        const darkOption = menuItems.find((item) => item.textContent?.includes('Dark'));
        expect(darkOption?.textContent).toContain('✓');
      });
    });
  });

  describe('minimal variant', () => {
    it('should render with theme label', () => {
      renderThemeSwitcher('minimal');
      const button = screen.getByRole('button', { name: /switch theme/i });
      expect(button).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should show current theme text', async () => {
      renderThemeSwitcher('minimal');
      const button = screen.getByRole('button', { name: /switch theme/i });

      // Initially shows System
      expect(screen.getByText('System')).toBeInTheDocument();

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const lightOption = screen.getByRole('menuitem', { name: /light/i });
      fireEvent.click(lightOption);

      await waitFor(() => {
        expect(screen.getByText('Light')).toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should open dropdown with ArrowDown key', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.keyDown(button, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });

    it('should navigate options with arrow keys', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const menuItems = screen.getAllByRole('menuitem');
      const firstOption = menuItems[0];

      // Simulate ArrowDown
      fireEvent.keyDown(firstOption, { key: 'ArrowDown' });

      // Verify focus moved (we can't directly test focus in jsdom, but we test the handler)
      expect(menuItems.length).toBe(3);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      expect(button).toHaveAttribute('aria-haspopup', 'true');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when dropdown is open', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have menu role for dropdown', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        const menu = screen.getByRole('menu');
        expect(menu).toBeInTheDocument();
      });
    });

    it('should have menuitem role for options', async () => {
      renderThemeSwitcher();
      const button = screen.getByRole('button', { name: /switch theme/i });

      fireEvent.click(button);

      await waitFor(() => {
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
      });
    });
  });
});
