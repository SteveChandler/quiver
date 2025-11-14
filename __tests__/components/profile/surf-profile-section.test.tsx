import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SurfProfileSection } from '@/components/profile/surf-profile-section';
import { getUserLearnedPreferences, validateUserPreferences, updateUserSurfPreferences } from '@/actions/preference-actions';
import type { UserPreferencesData } from '@/actions/preference-actions';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

// Mock server actions
jest.mock('@/actions/preference-actions', () => ({
  getUserLearnedPreferences: jest.fn(),
  validateUserPreferences: jest.fn(),
  updateUserSurfPreferences: jest.fn(),
}));

// Mock sub-components
jest.mock('@/components/profile/learned-preferences-display', () => ({
  LearnedPreferencesDisplay: ({ preferences }: { preferences: UserSurfPreferences }) => (
    <div data-testid="learned-preferences-display">
      Preferences: {preferences.wave_min_ft}-{preferences.wave_max_ft} ft
    </div>
  ),
}));

jest.mock('@/components/profile/validation-prompt', () => ({
  ValidationPrompt: ({ onValidate, onEdit, sampleSize }: any) => (
    <div data-testid="validation-prompt">
      <button onClick={onValidate}>Yes, looks good!</button>
      <button onClick={onEdit}>Let me adjust</button>
      <span>Sample: {sampleSize}</span>
    </div>
  ),
}));

jest.mock('@/components/profile/preference-override-form', () => ({
  PreferenceOverrideForm: ({ onSave, onCancel }: any) => (
    <div data-testid="preference-override-form">
      <button onClick={() => onSave({ wave_min_ft: 3, wave_max_ft: 7 })}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

describe('SurfProfileSection', () => {
  const mockLearnedPreferences: UserSurfPreferences = {
    wave_min_ft: 2,
    wave_max_ft: 6,
    wave_period_min_s: 8,
    wave_period_max_s: 14,
    max_wind_mph: 15,
    preferred_wind_directions: [0, 90],
    preferred_tide_statuses: ['rising', 'high'],
    confidence: 0.85,
    sample_size: 25,
  };

  const mockUnvalidatedData: UserPreferencesData = {
    learned: { ...mockLearnedPreferences, validated_at: null },
    onboarding: {},
  };

  const mockValidatedData: UserPreferencesData = {
    learned: { ...mockLearnedPreferences, validated_at: '2024-01-15T12:00:00Z' },
    onboarding: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner while fetching', () => {
      (getUserLearnedPreferences as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { container } = render(<SurfProfileSection />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('text-ocean-blue');
    });
  });

  describe('Error State', () => {
    it('should display error message on fetch failure', async () => {
      (getUserLearnedPreferences as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      (getUserLearnedPreferences as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('should refetch when retry button clicked', async () => {
      (getUserLearnedPreferences as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByTestId('learned-preferences-display')).toBeInTheDocument();
      });

      expect(getUserLearnedPreferences).toHaveBeenCalledTimes(2);
    });
  });

  describe('No Data State', () => {
    it('should show empty state when no learned preferences', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue({
        learned: null,
        onboarding: {},
      });

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/not enough data yet/i)).toBeInTheDocument();
      });
    });

    it('should display surf emoji in empty state', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue({
        learned: null,
        onboarding: {},
      });

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText('🏄‍♂️')).toBeInTheDocument();
      });
    });

    it('should show tip to log more sessions', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue({
        learned: null,
        onboarding: {},
      });

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/log at least 5 surf sessions/i)).toBeInTheDocument();
      });
    });
  });

  describe('Unvalidated State', () => {
    it('should show validation prompt when not validated', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('validation-prompt')).toBeInTheDocument();
      });
    });

    it('should show learned preferences display', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('learned-preferences-display')).toBeInTheDocument();
      });
    });

    it('should show edit button', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });
    });

    it('should pass sample size to validation prompt', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/Sample: 25/i)).toBeInTheDocument();
      });
    });
  });

  describe('Validated State', () => {
    it('should not show validation prompt when validated', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.queryByTestId('validation-prompt')).not.toBeInTheDocument();
      });
    });

    it('should still show learned preferences display', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('learned-preferences-display')).toBeInTheDocument();
      });
    });

    it('should still show edit button', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });
    });
  });

  describe('Validation Flow', () => {
    it('should call validateUserPreferences when "Yes, looks good!" clicked', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);
      (validateUserPreferences as jest.Mock).mockResolvedValue(undefined);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/yes, looks good!/i)).toBeInTheDocument();
      });

      const validateButton = screen.getByText(/yes, looks good!/i);
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(validateUserPreferences).toHaveBeenCalledWith(true);
      });
    });

    it('should refetch preferences after validation', async () => {
      (getUserLearnedPreferences as jest.Mock)
        .mockResolvedValueOnce(mockUnvalidatedData)
        .mockResolvedValueOnce(mockValidatedData);
      (validateUserPreferences as jest.Mock).mockResolvedValue(undefined);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('validation-prompt')).toBeInTheDocument();
      });

      const validateButton = screen.getByText(/yes, looks good!/i);
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(getUserLearnedPreferences).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle validation error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);
      (validateUserPreferences as jest.Mock).mockRejectedValue(new Error('Validation failed'));

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/yes, looks good!/i)).toBeInTheDocument();
      });

      const validateButton = screen.getByText(/yes, looks good!/i);
      fireEvent.click(validateButton);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to validate preferences:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when "Let me adjust" clicked', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/let me adjust/i)).toBeInTheDocument();
      });

      const editButton = screen.getByText(/let me adjust/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });
    });

    it('should enter edit mode when "Edit Learned Preferences" button clicked', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /edit learned preferences/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });
    });

    it('should hide validation prompt in edit mode', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('validation-prompt')).toBeInTheDocument();
      });

      const editButton = screen.getByText(/let me adjust/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.queryByTestId('validation-prompt')).not.toBeInTheDocument();
      });
    });

    it('should hide learned preferences display in edit mode', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockUnvalidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByTestId('learned-preferences-display')).toBeInTheDocument();
      });

      const editButton = screen.getByText(/let me adjust/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.queryByTestId('learned-preferences-display')).not.toBeInTheDocument();
      });
    });
  });

  describe('Save Flow', () => {
    it('should call updateUserSurfPreferences when form saved', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);
      (updateUserSurfPreferences as jest.Mock).mockResolvedValue(undefined);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });

      const saveButton = screen.getByText(/^save$/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateUserSurfPreferences).toHaveBeenCalledWith({
          wave_min_ft: 3,
          wave_max_ft: 7,
        });
      });
    });

    it('should exit edit mode after save', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);
      (updateUserSurfPreferences as jest.Mock).mockResolvedValue(undefined);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });

      const saveButton = screen.getByText(/^save$/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByTestId('preference-override-form')).not.toBeInTheDocument();
      });
    });

    it('should refetch preferences after save', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);
      (updateUserSurfPreferences as jest.Mock).mockResolvedValue(undefined);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      expect(getUserLearnedPreferences).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });

      const saveButton = screen.getByText(/^save$/i);
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(getUserLearnedPreferences).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cancel Flow', () => {
    it('should exit edit mode when cancel clicked', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('preference-override-form')).not.toBeInTheDocument();
      });
    });

    it('should not call updateUserSurfPreferences when cancelled', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.getByTestId('preference-override-form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);

      expect(updateUserSurfPreferences).not.toHaveBeenCalled();
    });

    it('should show preferences display after cancel', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit learned preferences/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /edit learned preferences/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('learned-preferences-display')).not.toBeInTheDocument();
      });

      const cancelButton = screen.getByText(/cancel/i);
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByTestId('learned-preferences-display')).toBeInTheDocument();
      });
    });
  });

  describe('Additional Info', () => {
    it('should show "How it works" info in view mode', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/how it works:/i)).toBeInTheDocument();
      });
    });

    it('should display sample size in info text', async () => {
      (getUserLearnedPreferences as jest.Mock).mockResolvedValue(mockValidatedData);

      render(<SurfProfileSection />);

      await waitFor(() => {
        expect(screen.getByText(/Based on 25 sessions/i)).toBeInTheDocument();
      });
    });
  });
});
