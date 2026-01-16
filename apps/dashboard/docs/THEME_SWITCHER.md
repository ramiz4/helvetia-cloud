# Theme Switcher

This document describes the theme switcher implementation in the Helvetia Cloud dashboard.

## Overview

The dashboard supports three theme modes:

- **Light**: Light color scheme
- **Dark**: Dark color scheme (default)
- **System**: Follows the user's system preference

## Architecture

### ThemeContext (`src/lib/ThemeContext.tsx`)

The `ThemeContext` provides theme state management across the application:

- **State Management**: Uses React Context API
- **Persistence**: Theme preference is saved to `localStorage` with key `theme-preference`
- **System Detection**: Automatically detects system theme preference using `window.matchMedia`
- **Dynamic Updates**: Listens for system theme changes when in "system" mode

#### API

```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark'; // The actual theme being used
}
```

### ThemeSwitcher Component (`src/components/ThemeSwitcher.tsx`)

A dropdown component for switching between themes:

- **Variants**:
  - `default`: Icon-only button with dropdown
  - `minimal`: Button with label and dropdown (used in mobile menu)
- **Accessibility**: Full keyboard navigation support with Arrow keys and Escape
- **ARIA Labels**: Proper semantic HTML with `role="menu"` and `role="menuitem"`

#### Usage

```tsx
import ThemeSwitcher from '@/components/ThemeSwitcher';

// Desktop navigation (icon only)
<ThemeSwitcher />

// Mobile menu (with label)
<ThemeSwitcher variant="minimal" />
```

## Integration

### Layout

The `ThemeProvider` is wrapped around the entire application in `app/layout.tsx`:

```tsx
<ThemeProvider>
  <LanguageProvider>{/* Rest of app */}</LanguageProvider>
</ThemeProvider>
```

### Navigation

The `ThemeSwitcher` is integrated into the Navigation component:

- Desktop: Appears before the language switcher
- Mobile: Appears in the mobile menu below language selector

## Styling

### Tailwind Configuration

Dark mode is enabled with class strategy in `tailwind.config.ts`:

```typescript
darkMode: 'class',
```

### Usage in Components

Use Tailwind's dark mode utilities:

```tsx
<div className="bg-slate-50 dark:bg-slate-950">
  <p className="text-slate-900 dark:text-slate-200">Content</p>
</div>
```

### Transitions

Smooth theme transitions are applied via CSS:

```css
transition-colors duration-300
```

## Translations

Theme labels are translated in all supported languages (en, de, fr, it, gsw):

```json
{
  "theme": {
    "light": "Light",
    "dark": "Dark",
    "system": "System",
    "switchTheme": "Switch theme"
  }
}
```

## Testing

Comprehensive tests cover:

- Theme state management (`ThemeContext.test.tsx`)
- Component rendering and interaction (`ThemeSwitcher.test.tsx`)
- Keyboard navigation
- Accessibility attributes
- localStorage persistence
- System preference detection

Run tests:

```bash
pnpm --filter dashboard test
```

## Browser Support

- Modern browsers with `matchMedia` support
- Graceful fallback to dark mode if matchMedia is unavailable
- localStorage support required for persistence

## Implementation Checklist

- [x] ThemeContext with state management
- [x] localStorage persistence
- [x] ThemeSwitcher component
- [x] Integration into Navigation
- [x] Tailwind dark mode configuration
- [x] Smooth transitions
- [x] Keyboard navigation
- [x] ARIA labels and accessibility
- [x] Comprehensive tests
- [x] Multi-language support
- [ ] Light mode styling for all components (progressive enhancement)

## Future Enhancements

- Add more granular theme customization (accent colors, etc.)
- Add theme preview before switching
- Add per-page theme overrides if needed
- Sync theme across browser tabs using storage events (partially implemented)
