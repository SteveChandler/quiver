/**
 * Tests for ValidationPrompt component
 *
 * Validates:
 * - Display of validation prompt message
 * - "Yes, looks good!" button functionality
 * - "Let me adjust" button functionality
 * - Loading states during validation
 * - Error handling
 * - Accessibility
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidationPrompt } from '@/components/profile/validation-prompt';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      className={className}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

describe('ValidationPrompt', () => {
  const mockOnValidate = jest.fn();
  const mockOnEdit = jest.fn();
  const mockSampleSize = 15;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Display', () => {
    it('should display validation prompt message', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(
        screen.getByText(/Do these preferences match your surfing style/i)
      ).toBeInTheDocument();
    });

    it('should display sample size in explanation', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(screen.getByText(/analyzed 15 of your sessions/i)).toBeInTheDocument();
    });

    it('should use singular "session" for sample size of 1', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={1}
        />
      );

      expect(screen.getByText(/analyzed 1 of your session/i)).toBeInTheDocument();
    });

    it('should use plural "sessions" for sample size > 1', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={10}
        />
      );

      expect(screen.getByText(/analyzed 10 of your sessions/i)).toBeInTheDocument();
    });

    it('should display wave emoji', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(screen.getByText('🌊')).toBeInTheDocument();
    });
  });

  describe('"Yes, looks good!" Button', () => {
    it('should render "Yes, looks good!" button', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(screen.getByText(/Yes, looks good!/i)).toBeInTheDocument();
    });

    it('should call onValidate when clicked', async () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const yesButton = screen.getByText(/Yes, looks good!/i);
      fireEvent.click(yesButton);

      await waitFor(() => {
        expect(mockOnValidate).toHaveBeenCalledTimes(1);
      });
    });

    it('should show loading state during validation', async () => {
      const slowValidate = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(
        <ValidationPrompt
          onValidate={slowValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const yesButton = screen.getByText(/Yes, looks good!/i);
      fireEvent.click(yesButton);

      // Should be disabled during loading
      await waitFor(() => {
        expect(yesButton).toBeDisabled();
      });
    });

    it('should be disabled when isValidating is true', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          isValidating={true}
        />
      );

      const yesButton = screen.getByText(/Yes, looks good!/i);
      expect(yesButton).toBeDisabled();
    });

    it('should have primary variant', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const yesButton = screen.getByText(/Yes, looks good!/i);
      expect(yesButton).toHaveAttribute('data-variant', 'default');
    });
  });

  describe('"Let me adjust" Button', () => {
    it('should render "Let me adjust" button', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(screen.getByText(/Let me adjust/i)).toBeInTheDocument();
    });

    it('should call onEdit when clicked', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const editButton = screen.getByText(/Let me adjust/i);
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when isValidating is true', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          isValidating={true}
        />
      );

      const editButton = screen.getByText(/Let me adjust/i);
      expect(editButton).toBeDisabled();
    });

    it('should have outline variant', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const editButton = screen.getByText(/Let me adjust/i);
      expect(editButton).toHaveAttribute('data-variant', 'outline');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when provided', () => {
      const errorMessage = 'Failed to validate preferences';

      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          error={errorMessage}
        />
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should not display error when error is null', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          error={null}
        />
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should clear error on retry', async () => {
      const { rerender } = render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          error="Previous error"
        />
      );

      expect(screen.getByText('Previous error')).toBeInTheDocument();

      // Simulate error clearing
      rerender(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          error={null}
        />
      );

      expect(screen.queryByText('Previous error')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });

    it('should have accessible button labels', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(screen.getByText(/Yes, looks good!/i)).toBeInTheDocument();
      expect(screen.getByText(/Let me adjust/i)).toBeInTheDocument();
    });

    it('should mark error as alert role', () => {
      render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
          error="Validation failed"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Validation failed');
    });
  });

  describe('Layout', () => {
    it('should render in a card container', () => {
      const { container } = render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      expect(container.querySelector('.border')).toBeInTheDocument();
    });

    it('should stack buttons horizontally', () => {
      const { container } = render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const buttonContainer = container.querySelector('.flex');
      expect(buttonContainer).toBeInTheDocument();
      expect(buttonContainer).toHaveClass('gap-3');
    });

    it('should center content', () => {
      const { container } = render(
        <ValidationPrompt
          onValidate={mockOnValidate}
          onEdit={mockOnEdit}
          sampleSize={mockSampleSize}
        />
      );

      const content = container.querySelector('.text-center');
      expect(content).toBeInTheDocument();
    });
  });
});
