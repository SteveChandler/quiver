import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PreferenceOverrideForm } from '@/components/profile/preference-override-form';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';

describe('PreferenceOverrideForm', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  const mockCurrentPreferences: UserSurfPreferences = {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all form sections', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Wave Height')).toBeInTheDocument();
      expect(screen.getByText('Wave Period')).toBeInTheDocument();
      expect(screen.getByText('Wind Tolerance')).toBeInTheDocument();
      expect(screen.getByText('Preferred Wind Directions')).toBeInTheDocument();
      expect(screen.getByText('Preferred Tides')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save preferences/i })).toBeInTheDocument();
    });

    it('should render info banner', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/these overrides will be used to personalize/i)).toBeInTheDocument();
    });

    it('should have accessible form role', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('form', { name: /edit surf preferences/i })).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should populate wave height range from current preferences', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Preferred range: 2 - 6 ft/i)).toBeInTheDocument();
    });

    it('should populate wave period range from current preferences', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Preferred range: 8 - 14 seconds/i)).toBeInTheDocument();
    });

    it('should populate wind tolerance from current preferences', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Maximum: Up to 15 mph/i)).toBeInTheDocument();
    });

    it('should populate wind directions in compass', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Check that North and East are selected
      const northButton = screen.getByLabelText('North (0°)');
      const eastButton = screen.getByLabelText('East (90°)');

      expect(northButton).toHaveAttribute('aria-pressed', 'true');
      expect(eastButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should populate tide preferences in checkboxes', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const risingCheckbox = screen.getByLabelText(/rising/i);
      const highCheckbox = screen.getByLabelText(/^high$/i);

      expect(risingCheckbox).toBeChecked();
      expect(highCheckbox).toBeChecked();
    });

    it('should handle null values in preferences', () => {
      const nullPreferences: UserSurfPreferences = {
        wave_min_ft: null,
        wave_max_ft: null,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: null,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0,
        sample_size: 0,
      };

      render(
        <PreferenceOverrideForm
          currentPreferences={nullPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Should default to 0 for sliders
      expect(screen.getByText(/Preferred range: 0 - 0 ft/i)).toBeInTheDocument();
      expect(screen.getByText(/Maximum: Up to 0 mph/i)).toBeInTheDocument();
    });
  });

  describe('Tide Checkbox Interactions', () => {
    it('should allow checking unchecked tide', () => {
      const prefsWithNoTides: UserSurfPreferences = {
        ...mockCurrentPreferences,
        preferred_tide_statuses: [],
      };

      render(
        <PreferenceOverrideForm
          currentPreferences={prefsWithNoTides}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const risingCheckbox = screen.getByLabelText(/rising/i);
      expect(risingCheckbox).not.toBeChecked();

      fireEvent.click(risingCheckbox);
      expect(risingCheckbox).toBeChecked();
    });

    it('should allow unchecking checked tide', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const risingCheckbox = screen.getByLabelText(/rising/i);
      expect(risingCheckbox).toBeChecked();

      fireEvent.click(risingCheckbox);
      expect(risingCheckbox).not.toBeChecked();
    });

    it('should allow selecting multiple tides', () => {
      const prefsWithNoTides: UserSurfPreferences = {
        ...mockCurrentPreferences,
        preferred_tide_statuses: [],
      };

      render(
        <PreferenceOverrideForm
          currentPreferences={prefsWithNoTides}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const risingCheckbox = screen.getByLabelText(/rising/i);
      const fallingCheckbox = screen.getByLabelText(/falling/i);
      const lowCheckbox = screen.getByLabelText(/^low$/i);

      fireEvent.click(risingCheckbox);
      fireEvent.click(fallingCheckbox);
      fireEvent.click(lowCheckbox);

      expect(risingCheckbox).toBeChecked();
      expect(fallingCheckbox).toBeChecked();
      expect(lowCheckbox).toBeChecked();
    });

    it('should render all 4 tide options', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/rising/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^high$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/falling/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^low$/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onSave with form data when submitted', async () => {
      mockOnSave.mockResolvedValue(undefined);

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          wave_min_ft: 2,
          wave_max_ft: 6,
          wave_period_min_s: 8,
          wave_period_max_s: 14,
          max_wind_mph: 15,
          preferred_wind_directions: [0, 90],
          preferred_tide_statuses: ['rising', 'high'],
        });
      });
    });

    it('should show loading state while submitting', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/saving.../i)).toBeInTheDocument();
      });
    });

    it('should disable buttons while submitting', async () => {
      mockOnSave.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
      });
    });

    it('should display error message on save failure', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
    });

    it('should remain enabled after error', async () => {
      mockOnSave.mockRejectedValue(new Error('Network error'));

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Buttons should be enabled again
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Cancel Action', () => {
    it('should call onCancel when cancel button clicked', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when cancelled', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for sliders', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/wave height range/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/wave period range/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/maximum wind speed/i)).toBeInTheDocument();
    });

    it('should have accessible checkboxes with labels', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const risingCheckbox = screen.getByLabelText(/rising/i);
      const risingLabel = screen.getByText(/rising/i);

      expect(risingCheckbox).toHaveAttribute('id');
      expect(risingLabel).toHaveAttribute('for', risingCheckbox.id);
    });

    it('should display validation errors with role="alert"', async () => {
      mockOnSave.mockRejectedValue(new Error('Validation failed'));

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
      });
    });
  });

  describe('Form Integration', () => {
    it('should integrate wind compass changes into form', () => {
      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Click South direction (180°)
      const southButton = screen.getByLabelText('South (180°)');
      fireEvent.click(southButton);

      // South should now be selected
      expect(southButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should submit modified tide preferences', async () => {
      mockOnSave.mockResolvedValue(undefined);

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Uncheck 'rising'
      const risingCheckbox = screen.getByLabelText(/rising/i);
      fireEvent.click(risingCheckbox);

      // Check 'low'
      const lowCheckbox = screen.getByLabelText(/^low$/i);
      fireEvent.click(lowCheckbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            preferred_tide_statuses: expect.arrayContaining(['high', 'low']),
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle preferences with empty arrays', () => {
      const emptyPrefs: UserSurfPreferences = {
        ...mockCurrentPreferences,
        preferred_wind_directions: [],
        preferred_tide_statuses: [],
      };

      render(
        <PreferenceOverrideForm
          currentPreferences={emptyPrefs}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // No compass directions should be selected
      const northButton = screen.getByLabelText('North (0°)');
      expect(northButton).toHaveAttribute('aria-pressed', 'false');

      // No tides should be checked
      const risingCheckbox = screen.getByLabelText(/rising/i);
      expect(risingCheckbox).not.toBeChecked();
    });

    it('should handle generic error without message', async () => {
      mockOnSave.mockRejectedValue('Unknown error');

      render(
        <PreferenceOverrideForm
          currentPreferences={mockCurrentPreferences}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save preferences/i)).toBeInTheDocument();
      });
    });
  });
});
