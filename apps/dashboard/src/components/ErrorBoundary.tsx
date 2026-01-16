'use client';

import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { reportError } from '../lib/errorMonitoring';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Report to error monitoring service
    reportError(error, {
      componentStack: errorInfo.componentStack ?? undefined,
      tags: {
        errorBoundary: 'true',
      },
      extra: {
        timestamp: new Date().toISOString(),
      },
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center ring-8 ring-rose-500/5">
            <AlertTriangle size={40} className="text-rose-400" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
