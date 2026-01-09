'use client';

import { useEffect, useRef } from 'react';

interface FocusTrapProps {
  children: React.ReactNode;
  active?: boolean;
  onEscape?: () => void;
}

/**
 * FocusTrap component for managing focus within modals and dialogs
 * Prevents focus from leaving the trapped area and handles Escape key
 */
export default function FocusTrap({ children, active = true, onEscape }: FocusTrapProps) {
  const trapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const trap = trapRef.current;
    if (!trap) return;

    // Get all focusable elements within the trap
    const getFocusableElements = () => {
      const selector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(trap.querySelectorAll<HTMLElement>(selector));
    };

    // Focus first element on mount with a small delay for screen readers
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Use setTimeout to allow screen readers to announce the modal first
      setTimeout(() => {
        focusableElements[0].focus();
      }, 100);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Handle Tab navigation
      if (e.shiftKey) {
        // Shift + Tab: moving backward
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forward
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    trap.addEventListener('keydown', handleKeyDown);

    return () => {
      trap.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, onEscape]);

  return (
    <div ref={trapRef} className="focus-trap-container">
      {children}
    </div>
  );
}
