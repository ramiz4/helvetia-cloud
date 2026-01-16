import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as errorMonitoring from '../lib/errorMonitoring';
import { ErrorBoundary } from './ErrorBoundary';

// Mock the error monitoring module
vi.mock('../lib/errorMonitoring', () => ({
  reportError: vi.fn(),
  reportMessage: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
  setRouteContext: vi.fn(),
}));

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when there is an error', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('renders custom fallback when provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary fallback={<div>Custom error message</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('reports errors to monitoring service when error is caught', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reportErrorSpy = vi.spyOn(errorMonitoring, 'reportError');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    // Verify reportError was called
    expect(reportErrorSpy).toHaveBeenCalledTimes(1);

    // Verify the error object was passed
    const callArgs = reportErrorSpy.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Error);
    expect(callArgs[0].message).toBe('Test error');

    // Verify context was included
    expect(callArgs[1]).toMatchObject({
      tags: {
        errorBoundary: 'true',
      },
      extra: expect.objectContaining({
        timestamp: expect.any(String),
      }),
    });

    consoleSpy.mockRestore();
  });
});
