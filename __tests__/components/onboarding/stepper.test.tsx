import { render, screen } from '@testing-library/react';
import { Stepper } from '@/components/onboarding/stepper';

describe('Stepper', () => {
  describe('Rendering', () => {
    it('renders correct number of step indicators', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={6} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');
      expect(stepIndicators).toHaveLength(6);
    });

    it('renders with minimum steps (1)', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={1} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');
      expect(stepIndicators).toHaveLength(1);
    });

    it('renders with many steps', () => {
      const { container } = render(<Stepper currentStep={5} totalSteps={10} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');
      expect(stepIndicators).toHaveLength(10);
    });
  });

  describe('Step Highlighting', () => {
    it('highlights all steps up to and including current step', () => {
      const { container } = render(<Stepper currentStep={3} totalSteps={6} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      // Steps 0-3 should have ocean-blue class
      for (let i = 0; i <= 3; i++) {
        expect(stepIndicators[i].className).toContain('bg-ocean-blue');
      }

      // Steps 4-5 should have gray-200 class
      for (let i = 4; i < 6; i++) {
        expect(stepIndicators[i].className).toContain('bg-gray-200');
      }
    });

    it('highlights only first step when currentStep is 0', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={5} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      expect(stepIndicators[0].className).toContain('bg-ocean-blue');

      for (let i = 1; i < 5; i++) {
        expect(stepIndicators[i].className).toContain('bg-gray-200');
      }
    });

    it('highlights all steps when currentStep is last step', () => {
      const { container } = render(<Stepper currentStep={5} totalSteps={6} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('bg-ocean-blue');
      });
    });
  });

  describe('Styling', () => {
    it('applies correct height class (h-1.5)', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={3} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('h-1.5');
      });
    });

    it('applies rounded-full class', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={3} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('rounded-full');
      });
    });

    it('applies transition classes', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={3} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('transition-all');
        expect(indicator.className).toContain('duration-300');
      });
    });

    it('has correct gap spacing between indicators', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={3} />);

      const stepperContainer = container.querySelector('div.flex');
      expect(stepperContainer?.className).toContain('gap-2');
    });

    it('has correct bottom margin', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={3} />);

      const stepperContainer = container.querySelector('div.flex');
      expect(stepperContainer?.className).toContain('mb-6');
    });
  });

  describe('Progressive Updates', () => {
    it('updates highlighting when currentStep changes', () => {
      const { container, rerender } = render(<Stepper currentStep={1} totalSteps={5} />);

      let stepIndicators = container.querySelectorAll('div.flex-1');

      // Initially, steps 0-1 should be highlighted
      expect(stepIndicators[0].className).toContain('bg-ocean-blue');
      expect(stepIndicators[1].className).toContain('bg-ocean-blue');
      expect(stepIndicators[2].className).toContain('bg-gray-200');

      // Update to step 3
      rerender(<Stepper currentStep={3} totalSteps={5} />);

      stepIndicators = container.querySelectorAll('div.flex-1');

      // Now steps 0-3 should be highlighted
      expect(stepIndicators[0].className).toContain('bg-ocean-blue');
      expect(stepIndicators[1].className).toContain('bg-ocean-blue');
      expect(stepIndicators[2].className).toContain('bg-ocean-blue');
      expect(stepIndicators[3].className).toContain('bg-ocean-blue');
      expect(stepIndicators[4].className).toContain('bg-gray-200');
    });

    it('can go backwards (unhighlight steps)', () => {
      const { container, rerender } = render(<Stepper currentStep={4} totalSteps={6} />);

      let stepIndicators = container.querySelectorAll('div.flex-1');

      // Steps 0-4 should be highlighted
      for (let i = 0; i <= 4; i++) {
        expect(stepIndicators[i].className).toContain('bg-ocean-blue');
      }

      // Go back to step 2
      rerender(<Stepper currentStep={2} totalSteps={6} />);

      stepIndicators = container.querySelectorAll('div.flex-1');

      // Now only steps 0-2 should be highlighted
      for (let i = 0; i <= 2; i++) {
        expect(stepIndicators[i].className).toContain('bg-ocean-blue');
      }

      for (let i = 3; i < 6; i++) {
        expect(stepIndicators[i].className).toContain('bg-gray-200');
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles currentStep beyond totalSteps gracefully', () => {
      const { container } = render(<Stepper currentStep={10} totalSteps={5} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      // All steps should be highlighted when currentStep exceeds totalSteps
      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('bg-ocean-blue');
      });
    });

    it('handles negative currentStep gracefully', () => {
      const { container } = render(<Stepper currentStep={-1} totalSteps={5} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');

      // No steps should be highlighted for negative currentStep
      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('bg-gray-200');
      });
    });

    it('handles zero totalSteps without crashing', () => {
      const { container } = render(<Stepper currentStep={0} totalSteps={0} />);

      const stepIndicators = container.querySelectorAll('div.flex-1');
      expect(stepIndicators).toHaveLength(0);
    });
  });

  describe('Accessibility', () => {
    it('renders a visually meaningful progress indicator', () => {
      const { container } = render(<Stepper currentStep={3} totalSteps={6} />);

      // Verify the container has items-center for vertical alignment
      const stepperContainer = container.querySelector('div.flex');
      expect(stepperContainer?.className).toContain('items-center');
    });

    it('has consistent visual structure', () => {
      const { container } = render(<Stepper currentStep={2} totalSteps={5} />);

      const stepperContainer = container.querySelector('div.flex');
      const stepIndicators = container.querySelectorAll('div.flex-1');

      // Container should exist
      expect(stepperContainer).toBeInTheDocument();

      // All indicators should have same base classes
      stepIndicators.forEach((indicator) => {
        expect(indicator.className).toContain('h-1.5');
        expect(indicator.className).toContain('flex-1');
        expect(indicator.className).toContain('rounded-full');
      });
    });
  });
});
