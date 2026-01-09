---
applyTo: 'apps/dashboard/**/*.{ts,tsx,js,jsx,css}'
excludeAgent: ''
---

# Frontend (Dashboard) Instructions

## Next.js 16 & React 19 Best Practices

### Component Structure

- **Server Components**: Use by default. No `'use client'` needed unless using:
  - React hooks (useState, useEffect, useContext, etc.)
  - Browser APIs (window, document, localStorage)
  - Event handlers (onClick, onChange, etc.)
  - Third-party libraries requiring client-side execution
- **File Organization**:
  - Components: `src/components/[ComponentName]/[ComponentName].tsx`
  - Pages: `src/app/[route]/page.tsx`
  - Layouts: `src/app/[route]/layout.tsx`
  - API Routes: `src/app/api/[route]/route.ts`

### Styling with Tailwind CSS 4

- **Always use utility classes** - avoid custom CSS unless absolutely necessary
- **Responsive design**: Mobile-first approach using `sm:`, `md:`, `lg:`, `xl:` prefixes
- **Common patterns**:

  ```tsx
  // Container with padding
  <div className="container mx-auto px-4">
    Content
  </div>

  // Glassmorphic card (project style)
  <div className="rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
    Card content
  </div>

  // Button
  <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors">
    Click me
  </button>

  // Flexbox layout
  <div className="flex items-center justify-between gap-4">
    <span>Left</span>
    <span>Right</span>
  </div>

  // Grid layout
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </div>
  ```

### Data Fetching

- **Server Components**: Fetch data directly with async/await
  ```tsx
  export default async function Page() {
    const data = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/endpoint`).then((r) => r.json());
    return <div>{data.title}</div>;
  }
  ```
- **Client Components**: Use React hooks or TanStack Query if complex state needed

  ```tsx
  'use client';
  import { useState, useEffect } from 'react';

  export function ClientComponent() {
    const [data, setData] = useState<unknown | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/endpoint`);
          if (!response.ok) {
            throw new Error('Failed to fetch data');
          }
          const json = await response.json();
          setData(json);
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Unknown error while fetching data');
          console.error(error);
          setError(error);
        }
      };

      void fetchData();
    }, []);
  }
  ```

### State Management

- **Local state**: Use `useState` for component-specific state
- **Shared state**: Use React Context for app-wide state
- **Form state**: Use controlled components with `useState`
- **Avoid**: Redux, Zustand, or other state libraries unless complexity demands it

### API Integration

- Base API URL: `process.env.NEXT_PUBLIC_API_URL` (http://localhost:3001 in dev)
- WebSocket URL: `process.env.NEXT_PUBLIC_WS_URL` (ws://localhost:3001 in dev)
- Always handle loading and error states
- Example:
  ```tsx
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/services`);
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  ```

### Performance

- **Images**: Use Next.js `<Image>` component with proper `width`, `height`, and `alt`
- **Lazy Loading**: Use `dynamic()` for heavy components
  ```tsx
  import dynamic from 'next/dynamic';
  const HeavyComponent = dynamic(() => import('./HeavyComponent'));
  ```
- **Code Splitting**: Happens automatically with App Router
- **Memoization**: Use `useMemo` and `useCallback` only when profiling shows benefit

### TypeScript

- Define prop types with `interface` for components
- Use `type` for unions and utility types
- Example:

  ```tsx
  interface ButtonProps {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }

  export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
    return <button onClick={onClick}>{label}</button>;
  }
  ```

### Testing

- Test location: `__tests__/` directory or `*.test.tsx` files
- Use Testing Library: `@testing-library/react`
- Run tests: `pnpm --filter dashboard test`
- Example:

  ```tsx
  import { render, screen } from '@testing-library/react';
  import { Button } from './Button';

  test('renders button with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  ```

### Accessibility

- Always include `alt` text for images
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)
- Include ARIA labels where needed
- Ensure keyboard navigation works
- Test color contrast ratios

### Common Mistakes to Avoid

- ❌ Using `'use client'` unnecessarily - keep components server-side by default
- ❌ Fetching data in client components when it can be done server-side
- ❌ Writing custom CSS instead of using Tailwind utilities
- ❌ Forgetting to handle loading and error states
- ❌ Not optimizing images with Next.js Image component
- ❌ Using `any` type in TypeScript
- ❌ Hardcoding API URLs instead of using environment variables
