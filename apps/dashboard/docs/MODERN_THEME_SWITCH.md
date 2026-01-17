# Modern iOS-Style Theme Switch

## Overview

The dashboard now features a modern, glassmorphic iOS-style theme switch that replaces the previous dropdown menu. This provides a more intuitive and visually appealing way to toggle between light and dark themes.

## Design

The theme switch is inspired by iOS's latest design language, featuring:

- **Glassmorphic styling** with backdrop blur and gradient backgrounds
- **Smooth animations** for state transitions
- **Visual feedback** with sun (☀️) and moon (🌙) icons
- **Gradient effects** that change based on the current theme:
  - Light mode: Amber/orange gradients with sun icon
  - Dark mode: Indigo/purple gradients with moon icon

## Implementation

### Component: `ModernThemeSwitch.tsx`

Located at `src/components/ModernThemeSwitch.tsx`, this component provides two variants:

#### Default Variant (Desktop)

- Compact toggle switch (64px × 32px)
- Icon-only display
- Appears in the desktop navigation bar
- Hover effect with scale transformation

#### Minimal Variant (Mobile)

- Toggle switch with text label
- Shows current mode ("Dark Mode" or "Light Mode")
- Displays "(Auto)" indicator when using system preference
- Full-width button style for mobile menu

### Features

1. **Theme Persistence**
   - Saves preference to `localStorage`
   - Maintains state across browser sessions
   - Key: `theme-preference`

2. **System Theme Support**
   - Automatically detects system preference
   - Updates when system theme changes
   - Shows visual indicator when in auto mode

3. **Smooth Transitions**
   - 300ms animation duration
   - Ease-out timing function
   - Thumb slides with glassmorphic effect

4. **Accessibility**
   - ARIA labels for screen readers
   - `aria-pressed` state for toggle indication
   - Keyboard navigable
   - Focus visible with ring effect

## Usage

### Desktop Navigation

```tsx
import ModernThemeSwitch from '@/components/ModernThemeSwitch';

// In navigation component
<ModernThemeSwitch />;
```

### Mobile Navigation

```tsx
import ModernThemeSwitch from '@/components/ModernThemeSwitch';

// In mobile menu
<ModernThemeSwitch variant="minimal" />;
```

## Visual Design Details

### Light Mode (Amber Theme)

- Background: `gradient-to-br from-amber-500/20 to-orange-500/20`
- Border: `border-amber-400/30`
- Shadow: Amber glow effect
- Icon: Sun (☀️) in amber-500 color

### Dark Mode (Indigo Theme)

- Background: `gradient-to-br from-indigo-500/30 to-purple-500/30`
- Border: `border-indigo-400/30`
- Shadow: Indigo glow effect
- Icon: Moon (🌙) in indigo-400 color

### Thumb (Slider)

- Size: 28px × 28px
- Background: `bg-white/90 dark:bg-slate-800/90`
- Backdrop blur for glassmorphic effect
- Position: Slides between left (light) and right (dark)
- Shadow: Colored based on current theme

## Animation Details

- **Transition Duration**: 300ms
- **Timing Function**: `ease-out` for smooth deceleration
- **Hover Effect**: Scale 1.05 on hover (desktop only)
- **Active Effect**: Scale 0.95 on click
- **Thumb Movement**: Slides from left (0.5rem) to right (32px)

## Browser Support

- Modern browsers with CSS backdrop-filter support
- Graceful fallback for older browsers
- No JavaScript required for visual appearance

## Testing

Comprehensive tests are located in `ModernThemeSwitch.test.tsx`:

- Component rendering
- Theme toggling functionality
- Accessibility attributes
- Keyboard navigation
- Visual variants (default & minimal)
- Loading state handling

Run tests:

```bash
pnpm --filter dashboard test -- ModernThemeSwitch
```

## Screenshots

### Desktop View

![Light Mode Desktop](https://github.com/user-attachments/assets/9b0ab340-bc39-468d-b80e-163b920ede2c)
![Dark Mode Desktop](https://github.com/user-attachments/assets/be34f5cf-6dca-400e-b26f-2ceafec23fb9)

### Mobile View

![Mobile Menu Dark](https://github.com/user-attachments/assets/cf0bd72a-b08f-430d-b4ad-0d433c5f748d)

## Migration from Old ThemeSwitcher

The old `ThemeSwitcher` component (dropdown-based) is still available but has been replaced in the Navigation component with `ModernThemeSwitch`.

### Key Differences

| Feature         | Old ThemeSwitcher    | ModernThemeSwitch                 |
| --------------- | -------------------- | --------------------------------- |
| UI Style        | Dropdown menu        | iOS-style toggle                  |
| Options         | Light/Dark/System    | Light/Dark (system auto-detected) |
| Desktop Size    | ~160px width         | 64px × 32px                       |
| Mobile Style    | Dropdown with labels | Toggle with label                 |
| Visual Feedback | Text + icon          | Gradient + animation              |
| Interaction     | Click to open menu   | Direct toggle                     |

## Future Enhancements

Potential improvements for future versions:

- Long-press to show system preference option
- Haptic feedback on mobile devices
- Custom color scheme selection
- Per-page theme overrides
- Theme transition animations (fade between themes)
