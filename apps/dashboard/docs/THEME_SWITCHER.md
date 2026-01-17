# Theme Switcher

## Overview

The dashboard uses a modern, glassmorphic iOS-style theme switch to toggle between **Light**, **Dark**, and **System** modes. The UI features smooth animations and visual feedback with Sun (☀️) and Moon (🌙) icons.

## Architecture

### ThemeContext (`src/lib/ThemeContext.tsx`)

Managed via React Context API:

- **State**: `'light'` | `'dark'` | `'system'`.
- **Persistence**: Saves to `localStorage` key `theme-preference`.
- **System Detection**: Listeners for `window.matchMedia('(prefers-color-scheme: dark)')`.
- **Resolution**: specific theme overrides system; system follows OS.

### ModernThemeSwitch (`src/components/ModernThemeSwitch.tsx`)

The primary component replacing the legacy dropdown.

**Variants**:

- **Default (Desktop)**: Compact (64px × 32px) toggle, icon-only, hover scale effects.
- **Minimal (Mobile)**: Button with label ("Dark/Light Mode"), shows "(Auto)" if system-set.

**Visual Design**:

- **Light Mode**: Amber/Orange gradients, Sun icon.
- **Dark Mode**: Indigo/Purple glassmorphic gradients, Moon icon.
- **Transition**: 300ms `ease-out` sliding thumb with backdrop blur.

## Usage

```tsx
import ModernThemeSwitch from '@/components/ModernThemeSwitch';

// Desktop (Navbar) - Icon only
<ModernThemeSwitch />

// Mobile (Menu) - With label
<ModernThemeSwitch variant="minimal" />
```

## Integration

- **Layout**: Application wrapped in `ThemeProvider` (`app/layout.tsx`).
- **Styling**: Tailwind CSS with `darkMode: 'class'`. Smooth transitions via `transition-colors duration-300`.
- **Translations**: Labels support [en, de, fr, it, gsw].

## Testing & Browser Support

- **Tests**: Covered in `ModernThemeSwitch.test.tsx` (interactions, a11y) and `ThemeContext.test.tsx` (logic).
- **Browsers**: Requires `window.matchMedia` and `backdrop-filter` (modern browsers). Fallbacks provided.
