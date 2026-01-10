# Keyboard Navigation Guide

## Dashboard Keyboard Shortcuts

Helvetia Cloud dashboard is fully keyboard accessible. This guide helps you navigate efficiently using only your keyboard.

---

## Global Shortcuts

### Skip Navigation

- **Tab** (when page loads) → Reveals "Skip to main content" link
- **Enter** → Jump directly to main content area

---

## Navigation Bar

### Desktop Navigation

- **Tab** → Move through navigation items
- **Enter** or **Space** → Activate links and buttons
- **Shift + Tab** → Move backwards through navigation items

### Mobile Menu

- **Tab** → Focus on menu button
- **Enter** or **Space** → Open mobile menu
- **Escape** → Close mobile menu
- **Arrow Keys** → Navigate through menu items
- **Enter** → Select menu item

---

## Language Switcher

### Dropdown Mode (Desktop)

- **Tab** → Focus on language switcher button
- **Enter** or **Space** or **Arrow Down** → Open language menu
- **Arrow Up/Down** → Navigate between languages
- **Enter** → Select language
- **Escape** → Close menu without selecting
- **Tab** → Close menu and move to next element

### Button Mode (Mobile)

- **Tab** → Move between language buttons
- **Enter** or **Space** → Select language

---

## User Menu

- **Tab** → Focus on user menu button
- **Enter** or **Space** → Open user menu
- **Arrow Up/Down** → Navigate menu items
- **Enter** → Select menu item
- **Escape** → Close menu
- **Tab** → Close menu and move to next element

---

## Dashboard & Services

### Service Cards

- **Tab** → Navigate between interactive elements
- **Enter** or **Space** → Activate buttons
- **Shift + Tab** → Move backwards

### Action Buttons

- **Tab** → Focus on action buttons (Edit, Delete, Restart, Logs, Visit)
- **Enter** or **Space** → Execute action

### Search

- **Tab** → Focus on search input
- **Type** → Filter services in real-time
- **Escape** → Clear search (if input is focused)

---

## Modals & Dialogs

### Focus Trap

When a modal is open:

- **Tab** → Move to next focusable element in modal
- **Shift + Tab** → Move to previous focusable element
- **Escape** → Close modal
- Focus automatically returns to the trigger element when closed

### Logs Modal

- **Tab** → Navigate through Close button and scrollable content
- **Escape** → Close logs viewer
- **Arrow Up/Down** → Scroll through logs (when focused on content area)

### Edit Service Modal

- **Tab** → Navigate through form fields
- **Enter** → Submit form (when Save button is focused)
- **Escape** → Cancel and close modal
- **Tab** → Cycle through: fields → buttons → back to fields

---

## Forms

### Text Inputs

- **Tab** → Move to next field
- **Shift + Tab** → Move to previous field
- **Enter** → Submit form (if in final field)

### Dropdowns (select elements)

- **Tab** → Focus on dropdown
- **Space** or **Arrow Down** → Open options
- **Arrow Up/Down** → Navigate options
- **Enter** → Select option
- **Escape** → Close without selecting

### Checkboxes & Radio Buttons

- **Tab** → Focus on control
- **Space** → Toggle checkbox or select radio button
- **Arrow Keys** → Navigate between radio buttons in same group

---

## Tips for Efficient Keyboard Navigation

1. **Use Skip Links:** Press Tab immediately when a page loads to reveal the skip navigation link
2. **Tab Extensively:** Tab is your primary navigation tool
3. **Use Escape Liberally:** Escape closes most overlays and menus
4. **Arrow Keys in Menus:** Use arrow keys to navigate dropdown menus instead of Tab
5. **Shift + Tab:** Don't forget you can move backwards
6. **Focus Indicators:** Look for the focus ring (usually blue outline) to see where you are

---

## Accessibility Features

### Screen Readers

The dashboard is optimized for screen readers:

- All interactive elements have descriptive labels
- Status changes are announced
- Modal states are properly communicated
- Form validation errors are announced

### Focus Management

- Focus is trapped in modals (can't tab out)
- Focus returns to trigger element when closing overlays
- Logical tab order throughout the interface

### ARIA Labels

All controls include proper ARIA attributes for assistive technologies:

- `aria-label` for icon-only buttons
- `aria-expanded` for dropdowns
- `aria-haspopup` for menus
- `role` attributes for semantic meaning

---

## Reporting Issues

If you encounter any keyboard navigation issues:

1. Note the exact page and element
2. Document the expected vs actual behavior
3. Report via GitHub Issues with label `accessibility`

---

## Browser Compatibility

Keyboard navigation is tested and supported on:

- Chrome/Edge (Windows, macOS, Linux)
- Firefox (Windows, macOS, Linux)
- Safari (macOS)

---

## Further Resources

- [WebAIM Keyboard Navigation](https://webaim.org/articles/keyboard/)
- [WCAG 2.1 Keyboard Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/keyboard)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
