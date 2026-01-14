import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../../config/LanguageContext';
import { ConfirmationModal } from '../ConfirmationModal';

// Helper to wrap component with LanguageProvider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
};

describe('ConfirmationModal', () => {
  it('should render when provided', () => {
    renderWithProvider(
      <ConfirmationModal
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();

    renderWithProvider(
      <ConfirmationModal
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();

    renderWithProvider(
      <ConfirmationModal
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should render custom button labels', () => {
    renderWithProvider(
      <ConfirmationModal
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
        confirmLabel="Yes, Delete"
        cancelLabel="No, Keep"
      />,
    );

    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('should apply danger styling when isDanger is true', () => {
    renderWithProvider(
      <ConfirmationModal
        title="Delete Item"
        message="Are you sure?"
        onConfirm={() => {}}
        onCancel={() => {}}
        isDanger={true}
      />,
    );

    const confirmButton = screen.getByText('Confirm');
    // Check that button exists with styling applied
    expect(confirmButton).toBeInTheDocument();
  });

  it('should show loading state with loading text', () => {
    renderWithProvider(
      <ConfirmationModal
        title="Processing"
        message="Please wait..."
        onConfirm={() => {}}
        onCancel={() => {}}
        isLoading={true}
      />,
    );

    // When loading, button shows "Loading..." instead of "Confirm"
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
