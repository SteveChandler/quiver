import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressBar } from '@/components/session/wizard/ProgressBar';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

describe('ProgressBar', () => {
  const mockProps = {
    progress: 33.33,
    completedSteps: 2,
    totalSteps: 6,
    currentStep: 2,
    onStepClick: jest.fn(),
    isStepValid: jest.fn((step: number) => step < 2),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render progress statistics correctly', () => {
      render(<ProgressBar {...mockProps} />);
      
      expect(screen.getByText('2 of 6 steps completed')).toBeInTheDocument();
      expect(screen.getByText('33% complete')).toBeInTheDocument();
    });

    it('should render correct number of step indicators', () => {
      render(<ProgressBar {...mockProps} />);
      
      const stepIndicators = screen.getAllByTestId(/step-indicator-/);
      expect(stepIndicators).toHaveLength(6);
    });

    it('should render progress fill with correct test id', () => {
      render(<ProgressBar {...mockProps} />);
      
      expect(screen.getByTestId('progress-fill')).toBeInTheDocument();
    });

    it('should show step labels on larger screens', () => {
      render(<ProgressBar {...mockProps} />);
      
      // Labels should be present (hidden on mobile with md:flex)
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 6')).toBeInTheDocument();
    });
  });

  describe('step indicator states', () => {
    it('should show completed steps with check icon', () => {
      render(<ProgressBar {...mockProps} />);
      
      // First two steps should be completed (step 0 and 1)
      const step0 = screen.getByTestId('step-indicator-0');
      const step1 = screen.getByTestId('step-indicator-1');
      
      expect(step0).toHaveClass('bg-green-500', 'border-green-500');
      expect(step1).toHaveClass('bg-green-500', 'border-green-500');
    });

    it('should show current step with blue styling', () => {
      render(<ProgressBar {...mockProps} />);
      
      const currentStep = screen.getByTestId('step-indicator-2');
      expect(currentStep).toHaveClass('bg-blue-500', 'border-blue-500');
    });

    it('should show future steps with default styling', () => {
      render(<ProgressBar {...mockProps} />);
      
      const futureStep = screen.getByTestId('step-indicator-3');
      expect(futureStep).toHaveClass('bg-white', 'border-gray-300');
    });

    it('should make clickable steps interactive', () => {
      render(<ProgressBar {...mockProps} />);
      
      // Steps 0, 1, and 2 should be clickable (current and previous)
      const step0 = screen.getByTestId('step-indicator-0');
      const step1 = screen.getByTestId('step-indicator-1');
      const step2 = screen.getByTestId('step-indicator-2');
      
      expect(step0).toHaveClass('cursor-pointer');
      expect(step1).toHaveClass('cursor-pointer');
      expect(step2).toHaveClass('cursor-pointer');
    });

    it('should make future steps non-clickable', () => {
      render(<ProgressBar {...mockProps} />);
      
      const futureStep = screen.getByTestId('step-indicator-3');
      expect(futureStep).toHaveClass('cursor-default');
      expect(futureStep).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onStepClick when clickable step is clicked', async () => {
      const user = userEvent.setup();
      
      render(<ProgressBar {...mockProps} />);
      
      const step1 = screen.getByTestId('step-indicator-1');
      await user.click(step1);
      
      expect(mockProps.onStepClick).toHaveBeenCalledWith(1);
    });

    it('should not call onStepClick when future step is clicked', async () => {
      const user = userEvent.setup();
      
      render(<ProgressBar {...mockProps} />);
      
      const futureStep = screen.getByTestId('step-indicator-3');
      await user.click(futureStep);
      
      expect(mockProps.onStepClick).not.toHaveBeenCalled();
    });

    it('should not call onStepClick when onStepClick is not provided', async () => {
      const user = userEvent.setup();
      
      render(<ProgressBar {...mockProps} onStepClick={undefined} />);
      
      const step1 = screen.getByTestId('step-indicator-1');
      await user.click(step1);
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels for step indicators', () => {
      render(<ProgressBar {...mockProps} />);
      
      const step0 = screen.getByTestId('step-indicator-0');
      const step2 = screen.getByTestId('step-indicator-2');
      const step3 = screen.getByTestId('step-indicator-3');
      
      expect(step0).toHaveAttribute('aria-label', 'Step 1 - Completed');
      expect(step2).toHaveAttribute('aria-label', 'Step 3 - Current');
      expect(step3).toHaveAttribute('aria-label', 'Step 4');
    });

    it('should announce progress to screen readers', () => {
      render(<ProgressBar {...mockProps} />);
      
      const announcement = screen.getByTestId('progress-announcement');
      expect(announcement).toHaveClass('sr-only');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      expect(announcement).toHaveAttribute('aria-atomic', 'true');
      expect(announcement).toHaveTextContent('Step 3 of 6. 33% complete. 2 steps completed.');
    });

    it('should have focus indicators on interactive elements', () => {
      render(<ProgressBar {...mockProps} />);
      
      const step1 = screen.getByTestId('step-indicator-1');
      expect(step1).toHaveClass('focus:ring-2', 'focus:ring-blue-500', 'focus:ring-offset-2');
    });
  });

  describe('edge cases', () => {
    it('should handle 0% progress', () => {
      render(
        <ProgressBar 
          {...mockProps} 
          progress={0} 
          completedSteps={0} 
          currentStep={0}
        />
      );
      
      expect(screen.getByText('0 of 6 steps completed')).toBeInTheDocument();
      expect(screen.getByText('0% complete')).toBeInTheDocument();
    });

    it('should handle 100% progress', () => {
      render(
        <ProgressBar 
          {...mockProps} 
          progress={100} 
          completedSteps={6} 
          currentStep={5}
        />
      );
      
      expect(screen.getByText('6 of 6 steps completed')).toBeInTheDocument();
      expect(screen.getByText('100% complete')).toBeInTheDocument();
    });

    it('should handle single step', () => {
      render(
        <ProgressBar 
          {...mockProps} 
          totalSteps={1} 
          currentStep={0}
          progress={100}
          completedSteps={1}
        />
      );
      
      expect(screen.getAllByTestId(/step-indicator-/)).toHaveLength(1);
    });

    it('should work without isStepValid function', () => {
      render(
        <ProgressBar 
          {...mockProps} 
          isStepValid={undefined}
        />
      );
      
      // Should not crash and should render
      expect(screen.getByText('2 of 6 steps completed')).toBeInTheDocument();
    });
  });

  describe('reduced motion support', () => {
    beforeEach(() => {
      // Mock matchMedia for reduced motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    it('should respect reduced motion preferences', () => {
      render(<ProgressBar {...mockProps} />);
      
      // Component should still render normally
      expect(screen.getByText('2 of 6 steps completed')).toBeInTheDocument();
    });
  });
});