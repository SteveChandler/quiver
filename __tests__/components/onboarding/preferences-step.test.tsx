import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesStep } from '@/components/onboarding/steps/preferences-step';
import { useOnboardingStore } from '@/store/onboarding-store';

// Mock the onboarding store
jest.mock('@/store/onboarding-store', () => ({
  useOnboardingStore: jest.fn(),
}));

describe('PreferencesStep', () => {
  const mockUpdateData = jest.fn();
  const mockNextStep = jest.fn();
  const mockPrevStep = jest.fn();

  const defaultStoreState = {
    data: {},
    updateData: mockUpdateData,
    nextStep: mockNextStep,
    prevStep: mockPrevStep,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue(defaultStoreState);

    // Suppress console errors from Zod validation during tests
    jest.spyOn(console, 'error').mockImplementation((message) => {
      if (typeof message === 'string' && message.includes('ZodError')) {
        return;
      }
      console.warn(message);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders all 5 preference questions', () => {
      render(<PreferencesStep />);

      // Required questions
      expect(screen.getByText('Experience Level')).toBeInTheDocument();
      expect(screen.getByText('Surf Styles (select all that apply)')).toBeInTheDocument();

      // Optional questions
      expect(screen.getByText('Preferred Wave Size (optional)')).toBeInTheDocument();
      expect(screen.getByText('Preferred Break Type (optional)')).toBeInTheDocument();
      expect(screen.getByText('Crowd Tolerance (optional)')).toBeInTheDocument();
    });

    it('renders helper text explaining optional preferences', () => {
      render(<PreferencesStep />);

      expect(
        screen.getByText(/These preferences are optional/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/learn from your surf sessions over time/i)
      ).toBeInTheDocument();
    });

    it('renders page title and description', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Tell us about your surfing')).toBeInTheDocument();
      expect(screen.getByText('Help us personalize your experience')).toBeInTheDocument();
    });

    it('renders Back and Continue buttons', () => {
      render(<PreferencesStep />);

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe('Experience Level Question', () => {
    it('renders all 4 experience level options', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
      expect(screen.getByText('Expert')).toBeInTheDocument();
    });

    it('renders experience level descriptions', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Just getting started')).toBeInTheDocument();
      expect(screen.getByText('Catching waves regularly')).toBeInTheDocument();
      expect(screen.getByText('Experienced surfer')).toBeInTheDocument();
      expect(screen.getByText('Highly skilled')).toBeInTheDocument();
    });

    it('selects experience level when clicked', () => {
      render(<PreferencesStep />);

      const intermediateButton = screen.getByText('Intermediate').closest('button');
      const beginnerButton = screen.getByText('Beginner').closest('button');

      // Initially no selection
      expect(intermediateButton).not.toHaveClass('border-ocean-blue');

      // Click intermediate
      fireEvent.click(intermediateButton!);

      // Should be selected (CSS updated synchronously)
      expect(intermediateButton).toHaveClass('border-ocean-blue');
      expect(intermediateButton).toHaveClass('bg-blue-50');

      // Click beginner
      fireEvent.click(beginnerButton!);

      // Only beginner should be selected now
      expect(beginnerButton).toHaveClass('border-ocean-blue');
      expect(intermediateButton).not.toHaveClass('border-ocean-blue');
    });

    it('shows error when experience level is not selected and form is submitted', async () => {
      render(<PreferencesStep />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Please select your experience level/i)).toBeInTheDocument();
      });
    });
  });

  describe('Surf Styles Question', () => {
    it('renders all 6 surf style options', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Longboard')).toBeInTheDocument();
      expect(screen.getByText('Shortboard')).toBeInTheDocument();
      expect(screen.getByText('Funboard')).toBeInTheDocument();
      expect(screen.getByText('Bodyboard')).toBeInTheDocument();
      expect(screen.getByText('SUP')).toBeInTheDocument();
      expect(screen.getByText('Foil')).toBeInTheDocument();
    });

    it('allows multiple surf styles to be selected', async () => {
      render(<PreferencesStep />);

      const longboardButton = screen.getByText('Longboard').closest('button');
      const shortboardButton = screen.getByText('Shortboard').closest('button');

      fireEvent.click(longboardButton!);
      fireEvent.click(shortboardButton!);

      await waitFor(() => {
        expect(longboardButton).toHaveClass('border-ocean-blue');
        expect(shortboardButton).toHaveClass('border-ocean-blue');
      });
    });

    it('allows deselecting a surf style', async () => {
      render(<PreferencesStep />);

      const longboardButton = screen.getByText('Longboard').closest('button');

      // Select
      fireEvent.click(longboardButton!);
      await waitFor(() => {
        expect(longboardButton).toHaveClass('border-ocean-blue');
      });

      // Deselect
      fireEvent.click(longboardButton!);
      await waitFor(() => {
        expect(longboardButton).toHaveClass('border-gray-200');
      });
    });

    it('shows error when no surf styles are selected and form is submitted', async () => {
      render(<PreferencesStep />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/Select at least one style/i)).toBeInTheDocument();
      });
    });
  });

  describe('Wave Size Question (Optional)', () => {
    it('renders all 4 wave size options', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('Large')).toBeInTheDocument();
      expect(screen.getByText('Any Size')).toBeInTheDocument();
    });

    it('renders wave size descriptions', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('1-3 feet')).toBeInTheDocument();
      expect(screen.getByText('3-6 feet')).toBeInTheDocument();
      expect(screen.getByText('6+ feet')).toBeInTheDocument();
      expect(screen.getByText("I'll surf anything")).toBeInTheDocument();
    });

    it('selects wave size when clicked', async () => {
      render(<PreferencesStep />);

      const mediumButton = screen.getByText('Medium').closest('button');
      fireEvent.click(mediumButton!);

      await waitFor(() => {
        expect(mediumButton).toHaveClass('border-ocean-blue');
        expect(mediumButton).toHaveClass('bg-blue-50');
      });
    });

    it('allows changing wave size selection', async () => {
      render(<PreferencesStep />);

      const smallButton = screen.getByText('Small').closest('button');
      const largeButton = screen.getByText('Large').closest('button');

      // Select small
      fireEvent.click(smallButton!);
      await waitFor(() => {
        expect(smallButton).toHaveClass('border-ocean-blue');
      });

      // Change to large
      fireEvent.click(largeButton!);
      await waitFor(() => {
        expect(largeButton).toHaveClass('border-ocean-blue');
        expect(smallButton).toHaveClass('border-gray-200');
      });
    });
  });

  describe('Break Type Question (Optional)', () => {
    it('renders all 4 break type options', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Beach Break')).toBeInTheDocument();
      expect(screen.getByText('Point Break')).toBeInTheDocument();
      expect(screen.getByText('Reef Break')).toBeInTheDocument();
      expect(screen.getByText('Any Type')).toBeInTheDocument();
    });

    it('renders break type descriptions', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Sandy bottom')).toBeInTheDocument();
      expect(screen.getByText('Rocky point')).toBeInTheDocument();
      expect(screen.getByText('Coral or rock reef')).toBeInTheDocument();
      expect(screen.getByText("I'll surf anywhere")).toBeInTheDocument();
    });

    it('selects break type when clicked', async () => {
      render(<PreferencesStep />);

      const pointBreakButton = screen.getByText('Point Break').closest('button');
      fireEvent.click(pointBreakButton!);

      await waitFor(() => {
        expect(pointBreakButton).toHaveClass('border-ocean-blue');
        expect(pointBreakButton).toHaveClass('bg-blue-50');
      });
    });
  });

  describe('Crowd Preference Question (Optional)', () => {
    it('renders all 3 crowd preference options', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Love the crew')).toBeInTheDocument();
      expect(screen.getByText('A few people is fine')).toBeInTheDocument();
      expect(screen.getByText('Prefer solitude')).toBeInTheDocument();
    });

    it('renders crowd preference descriptions', () => {
      render(<PreferencesStep />);

      expect(screen.getByText('Enjoy surfing with others')).toBeInTheDocument();
      expect(screen.getByText('Small crowds are okay')).toBeInTheDocument();
      expect(screen.getByText('Like uncrowded spots')).toBeInTheDocument();
    });

    it('selects crowd preference when clicked', async () => {
      render(<PreferencesStep />);

      const moderateButton = screen.getByText('A few people is fine').closest('button');
      fireEvent.click(moderateButton!);

      await waitFor(() => {
        expect(moderateButton).toHaveClass('border-ocean-blue');
        expect(moderateButton).toHaveClass('bg-blue-50');
      });
    });
  });

  describe('Form Submission', () => {
    it('submits form with only required fields', async () => {
      render(<PreferencesStep />);

      // Select required fields
      const intermediateButton = screen.getByText('Intermediate').closest('button');
      const longboardButton = screen.getByText('Longboard').closest('button');

      fireEvent.click(intermediateButton!);
      fireEvent.click(longboardButton!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalledWith(
          expect.objectContaining({
            experienceLevel: 'intermediate',
            surfStyles: expect.arrayContaining(['longboard']),
          })
        );
        expect(mockNextStep).toHaveBeenCalled();
      });
    });

    it('submits form with all fields including optional preferences', async () => {
      render(<PreferencesStep />);

      // Select required fields
      fireEvent.click(screen.getByText('Advanced').closest('button')!);
      fireEvent.click(screen.getByText('Shortboard').closest('button')!);

      // Select optional fields
      fireEvent.click(screen.getByText('Medium').closest('button')!);
      fireEvent.click(screen.getByText('Point Break').closest('button')!);
      fireEvent.click(screen.getByText('A few people is fine').closest('button')!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalledWith(
          expect.objectContaining({
            experienceLevel: 'advanced',
            surfStyles: expect.arrayContaining(['shortboard']),
            preferredWaveSize: 'medium',
            preferredBreakType: 'point',
            crowdPreference: 'moderate',
          })
        );
        expect(mockNextStep).toHaveBeenCalled();
      });
    });

    it('disables Continue button when required fields are missing', () => {
      render(<PreferencesStep />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeDisabled();
    });

    it('enables Continue button when required fields are filled', async () => {
      render(<PreferencesStep />);

      fireEvent.click(screen.getByText('Beginner').closest('button')!);
      fireEvent.click(screen.getByText('Longboard').closest('button')!);

      await waitFor(() => {
        const continueButton = screen.getByRole('button', { name: /continue/i });
        expect(continueButton).not.toBeDisabled();
      });
    });
  });

  describe('Navigation', () => {
    it('calls prevStep when Back button is clicked', () => {
      render(<PreferencesStep />);

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      expect(mockPrevStep).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for wave size options', () => {
      render(<PreferencesStep />);

      expect(screen.getByLabelText('Small waves - 1-3 feet')).toBeInTheDocument();
      expect(screen.getByLabelText('Medium waves - 3-6 feet')).toBeInTheDocument();
      expect(screen.getByLabelText('Large waves - 6+ feet')).toBeInTheDocument();
      expect(screen.getByLabelText("Any Size waves - I'll surf anything")).toBeInTheDocument();
    });

    it('has proper ARIA labels for break type options', () => {
      render(<PreferencesStep />);

      expect(screen.getByLabelText('Beach Break - Sandy bottom')).toBeInTheDocument();
      expect(screen.getByLabelText('Point Break - Rocky point')).toBeInTheDocument();
      expect(screen.getByLabelText('Reef Break - Coral or rock reef')).toBeInTheDocument();
      expect(screen.getByLabelText("Any Type - I'll surf anywhere")).toBeInTheDocument();
    });

    it('has proper ARIA labels for crowd preference options', () => {
      render(<PreferencesStep />);

      expect(screen.getByLabelText('Love the crew - Enjoy surfing with others')).toBeInTheDocument();
      expect(screen.getByLabelText('A few people is fine - Small crowds are okay')).toBeInTheDocument();
      expect(screen.getByLabelText('Prefer solitude - Like uncrowded spots')).toBeInTheDocument();
    });

    it('has role="alert" for error messages', async () => {
      render(<PreferencesStep />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it('all option buttons are keyboard accessible', () => {
      render(<PreferencesStep />);

      const allButtons = screen.getAllByRole('button');

      // All buttons should be in the tab order (no negative tabIndex)
      allButtons.forEach(button => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('Pre-populated Data', () => {
    it('loads existing preference data from store', () => {
      (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
        ...defaultStoreState,
        data: {
          experienceLevel: 'expert',
          surfStyles: ['shortboard', 'foil'],
          preferredWaveSize: 'large',
          preferredBreakType: 'reef',
          crowdPreference: 'solitude',
        },
      });

      render(<PreferencesStep />);

      // Verify selections are pre-populated
      expect(screen.getByText('Expert').closest('button')).toHaveClass('border-ocean-blue');
      expect(screen.getByText('Shortboard').closest('button')).toHaveClass('border-ocean-blue');
      expect(screen.getByText('Foil').closest('button')).toHaveClass('border-ocean-blue');
      expect(screen.getByText('Large').closest('button')).toHaveClass('border-ocean-blue');
      expect(screen.getByText('Reef Break').closest('button')).toHaveClass('border-ocean-blue');
      expect(screen.getByText('Prefer solitude').closest('button')).toHaveClass('border-ocean-blue');
    });
  });

  describe('Validation', () => {
    it('accepts valid optional field values', async () => {
      render(<PreferencesStep />);

      // Select all valid values
      fireEvent.click(screen.getByText('Intermediate').closest('button')!);
      fireEvent.click(screen.getByText('Longboard').closest('button')!);
      fireEvent.click(screen.getByText('Small').closest('button')!);
      fireEvent.click(screen.getByText('Beach Break').closest('button')!);
      fireEvent.click(screen.getByText('Love the crew').closest('button')!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalled();
        expect(mockNextStep).toHaveBeenCalled();
      });
    });

    it('allows submitting without optional fields', async () => {
      render(<PreferencesStep />);

      // Only select required fields
      fireEvent.click(screen.getByText('Beginner').closest('button')!);
      fireEvent.click(screen.getByText('Funboard').closest('button')!);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockUpdateData).toHaveBeenCalledWith(
          expect.objectContaining({
            experienceLevel: 'beginner',
            surfStyles: expect.arrayContaining(['funboard']),
          })
        );
        expect(mockNextStep).toHaveBeenCalled();
      });
    });
  });
});
