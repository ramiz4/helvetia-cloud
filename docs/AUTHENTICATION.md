# Authentication & Login System Documentation

## Overview

The authentication system provides a secure, modern, and accessible login experience using GitHub OAuth. It is designed with a "Glassmorphism" aesthetic to match the premium feel of the Helvetia Cloud platform.

## Architecture

- **Frontend**: Next.js (App Router) pages in `apps/dashboard/src/app/login`.
- **Authentication Provider**: GitHub OAuth (via `apps/api/src/routes/auth`).
- **State Management**: React Query for auth state and user profile.

---

## 1. UI Design & User Experience

### Design Philosophy

The login page is the first touchpoint for users and is designed to "wow":

- **Visuals**: Deep dark mode (`slate-950`) with vibrant indigo accents and blurred glass cards.
- **Animations**: Subtle entrance animations, hover shimmers on buttons, and smooth transitions.
- **Responsive**: Fully responsive design that adapts from mobile (single column) to desktop (split layout with benefits section).

### Key Components

- **Login Card**: The central interactive element.
  - _Glass Effect_: `bg-slate-900/50` with `backdrop-blur-xl`.
  - _Action_: "Continue with GitHub" button using the official GitHub logo.
- **Benefits Section** (Desktop): Displays value propositions (Swiss Privacy, High Performance, Enterprise Security) with icons.
- **Feedback**:
  - _Loading_: Suspense boundaries and loading spinners during auth redirection.
  - _Errors_: animated, red-tinted alerts for failed logins or expired sessions.

### Accessibility (a11y)

- **WCAG 2.1 AA Compliant**: Validated with `axe-core`.
- **Keyboard Navigation**: Full focus management and visible focus rings.
- **Screen Readers**: Proper ARIA labels and semantic HTML structure.

---

## 2. Implementation Details

### File Structure (`apps/dashboard`)

- `src/app/login/page.tsx`: Main login page component (Client Component).
- `src/app/login/layout.tsx`: Layout wrapper, handles SEO metadata and robots tags.
- `src/app/login/page.test.tsx`: Comprehensive test suite.

### Security

- **OAuth 2.0 Flow**: Uses standard Authorization Code flow.
- **State Parameter**: Prevents CSRF attacks during the OAuth handshake.
- **Cookie Security**: `HttpOnly`, `Secure`, and `SameSite` attributes are enforced on session cookies.
- **Robots**: Login page is explicitly marked `noindex, nofollow` to prevent search engine indexing.

### Internationalization (i18n)

Full support for multiple languages:

- **English (en)**
- **German (de)**
- **French (fr)**
- **Italian (it)**
- **Swiss German (gsw)**

Translations are managed in `packages/shared-ui/src/locales/*.json`.

---

## 3. Testing

The login system is rigorously tested to ensure reliability and accessibility.

### Automated Tests (`apps/dashboard/src/app/login/page.test.tsx`)

- **Total Tests**: 20 passing tests.
- **Coverage**:
  - **Rendering**: Verifies presence of logos, buttons, and text.
  - **Interactions**: Simulates button clicks and loading states.
  - **Error Handling**: Verifies error message display for query parameters (e.g., `?error=access_denied`).
  - **Accessibility**: Automated `axe-core` scans ensuring zero violations.

### Manual Verification

- **Flow**: Verifies the full round-trip to GitHub and back.
- **Responsive**: Verified on mobile, tablet, and desktop viewports.
- **Themes**: Verified consistency in Dark Mode (default).

## Future Roadmap

- **Two-Factor Authentication (2FA)**: To be implemented for enhanced security.
- **Audit Logs**: Tracking successful and failed login attempts.
- **Alternative Providers**: Potential support for GitLab or Bitbucket in the future.
