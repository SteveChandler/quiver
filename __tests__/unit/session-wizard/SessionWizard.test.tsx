import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionWizard } from '@/components/session/wizard/SessionWizard';

// Mock the useSessionWizard hook
const mockWizard = {
  currentStep: 0,
  totalSteps: 6,
  currentWizardStep: {
    id: 'location',
    title: 'Location',
    description: 'Choose where you\'ll be surfing',
    component: 'LocationStep',
    isRequired: true,
    validation: jest.fn(() => true),
    hints: ['Select a beach from the dropdown']
  },
  canGoNext: true,
  canGoPrev: false,
  isFirstStep: true,
  isLastStep: false,
  progress: 16.67,
  completedSteps: 0,
  nextStep: jest.fn(),
  prevStep: jest.fn(),
  goToStep: jest.fn(),
  isStepValid: jest.fn(() => true),
  isFormComplete: false,
  stepMotion: {
    initial: { x: 40, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
    transition: { type: "spring", damping: 22, stiffness: 260 }
  },
  progressMotion: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 0.6, ease: "easeOut" }
  },
  isAutosaving: false,
  autosaveStatus: 'idle' as const,
  lastSavedAt: null,
  mode: 'plan' as const,
  setMode: jest.fn(),
  loading: false,
  formState: {
    selectedBeach: '',
    selectedBeachId: '',
    selectedDate: '2024-01-01',
    selectedTime: '06:00',
    selectedBoard: '',
    boardId: '',
    duration: '1h',
    waveQuality: '',
    waterTemp: '',
    crowdLevel: '',
    parkingEase: '',
    overallRating: '',
    notes: '',
    photos: [],
    waveTypes: [],
  },
  updateField: jest.fn(),
  boards: [],
  beaches: [{ id: '1', name: 'Test Beach' }],
  refreshBoards: jest.fn(),
  isPlanning: true,
  trackStepView: jest.fn(),
  trackStepComplete: jest.fn(),
};

jest.mock('@/hooks/useSessionWizard', () => ({
  useSessionWizard: () => mockWizard
}));

// Mock the step components
jest.mock('@/components/session-forms/LocationStep', () => {
  return function LocationStep({ formState, updateField }: any) {
    return (
      <div data-testid="location-step">
        <input
          data-testid="beach-input"
          value={formState.selectedBeach}
          onChange={(e) => updateField('selectedBeach', e.target.value)}
          placeholder="Select beach"
        />
      </div>
    );
  };
});

jest.mock('@/components/session-forms/DateTimeStep', () => {
  return function DateTimeStep() {
    return <div data-testid="datetime-step">DateTime Step</div>;
  };
});

// Mock other step components
jest.mock('@/components/session-forms/EquipmentStep', () => {
  return function EquipmentStep() {
    return <div data-testid="equipment-step">Equipment Step</div>;
  };
});

jest.mock('@/components/session-forms/ConditionsSection', () => {
  return function ConditionsSection() {
    return <div data-testid="conditions-step">Conditions Step</div>;
  };
});

jest.mock('@/components/session-forms/GoalsSection', () => {
  return function GoalsSection() {
    return <div data-testid="goals-step">Goals Step</div>;
  };
});

jest.mock('@/components/session-forms/NotesSection', () => {
  return function NotesSection() {
    return <div data-testid="notes-step">Notes Step</div>;
  };
});

jest.mock('@/components/session-forms/PhotoSelectionSection', () => {
  return function PhotoSelectionSection() {
    return <div data-testid="photo-step">Photo Selection Step</div>;
  };
});

jest.mock('@/components/session-forms/OptimalTimesSection', () => {
  return function OptimalTimesSection() {
    return <div data-testid="optimal-times-step">Optimal Times Step</div>;
  };
});

jest.mock('@/components/session-forms/GearSuggestionsSection', () => {
  return function GearSuggestionsSection() {
    return <div data-testid="gear-suggestions-step">Gear Suggestions Step</div>;
  };
});

describe('SessionWizard', () => {
  const mockProps = {
    mode: 'plan' as const,
    onComplete: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the wizard with correct title', () => {
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('Plan Session')).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    });

    it('should render log session title when mode is log', () => {
      render(<SessionWizard {...mockProps} mode="log" />);
      
      expect(screen.getByText('Log Session')).toBeInTheDocument();
    });

    it('should render the current step content', () => {
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByTestId('location-step')).toBeInTheDocument();
      expect(screen.getByTestId('beach-input')).toBeInTheDocument();
    });

    it('should render step header with correct information', () => {
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Choose where you\'ll be surfing')).toBeInTheDocument();
    });

    it('should render guidance hints when step is not valid', () => {
      mockWizard.isStepValid = jest.fn(() => false);
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('Select a beach from the dropdown')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('should show Back button when not on first step', () => {
      mockWizard.canGoPrev = true;
      mockWizard.isFirstStep = false;
      
      render(<SessionWizard {...mockProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeInTheDocument();
      expect(backButton).not.toBeDisabled();
    });

    it('should hide Back button when on first step', () => {
      mockWizard.canGoPrev = false;
      mockWizard.isFirstStep = true;
      
      render(<SessionWizard {...mockProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toHaveClass('opacity-0', 'pointer-events-none');
    });

    it('should show Next button when not on last step', () => {
      mockWizard.isLastStep = false;
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('should show completion button when on last step', () => {
      mockWizard.isLastStep = true;
      mockWizard.isFormComplete = true;
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /plan session/i })).toBeInTheDocument();
    });

    it('should call nextStep when Next button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<SessionWizard {...mockProps} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      expect(mockWizard.nextStep).toHaveBeenCalled();
    });

    it('should call prevStep when Back button is clicked', async () => {
      const user = userEvent.setup();
      mockWizard.canGoPrev = true;
      mockWizard.isFirstStep = false;
      
      render(<SessionWizard {...mockProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);
      
      expect(mockWizard.prevStep).toHaveBeenCalled();
    });

    it('should disable Next button when step is invalid and required', () => {
      mockWizard.isStepValid = jest.fn(() => false);
      mockWizard.currentWizardStep.isRequired = true;
      
      render(<SessionWizard {...mockProps} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('progress display', () => {
    it('should render progress bar component', () => {
      render(<SessionWizard {...mockProps} />);
      
      // Progress bar should be rendered (we can test for its container)
      expect(screen.getByText('1 / 6')).toBeInTheDocument();
    });

    it('should show step counter in footer', () => {
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('1 / 6')).toBeInTheDocument();
    });
  });

  describe('autosave status', () => {
    it('should show saving status when autosaving', () => {
      mockWizard.isAutosaving = true;
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show saved status with timestamp', () => {
      mockWizard.autosaveStatus = 'saved';
      mockWizard.lastSavedAt = new Date('2024-01-01T12:00:00');
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText(/saved/i)).toBeInTheDocument();
    });
  });

  describe('completion handling', () => {
    it('should call onComplete when form is submitted on last step', async () => {
      const user = userEvent.setup();
      mockWizard.isLastStep = true;
      mockWizard.isFormComplete = true;
      
      render(<SessionWizard {...mockProps} />);
      
      const completeButton = screen.getByRole('button', { name: /plan session/i });
      await user.click(completeButton);
      
      expect(mockProps.onComplete).toHaveBeenCalledWith(mockWizard.formState);
    });

    it('should show loading state when submitting', () => {
      mockWizard.loading = true;
      mockWizard.isLastStep = true;
      
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      const submitButton = screen.getByRole('button', { name: /saving/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('cancel handling', () => {
    it('should show cancel button when onCancel is provided', () => {
      render(<SessionWizard {...mockProps} />);
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      
      render(<SessionWizard {...mockProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(mockProps.onCancel).toHaveBeenCalled();
    });

    it('should not show cancel button when onCancel is not provided', () => {
      render(<SessionWizard {...mockProps} onCancel={undefined} />);
      
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels and structure', () => {
      render(<SessionWizard {...mockProps} />);
      
      // Check for main content structure
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
      
      // Step counter should be visible
      expect(screen.getByText('1 / 6')).toBeInTheDocument();
    });

    it('should announce step changes to screen readers', () => {
      render(<SessionWizard {...mockProps} />);
      
      const announcement = screen.getByTestId('progress-announcement');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('form interaction', () => {
    it('should update form state when step components interact', async () => {
      const user = userEvent.setup();
      
      render(<SessionWizard {...mockProps} />);
      
      const beachInput = screen.getByTestId('beach-input');
      await user.type(beachInput, 'Malibu');
      
      expect(mockWizard.updateField).toHaveBeenCalledWith('selectedBeach', 'Malibu');
    });
  });
});