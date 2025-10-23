import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ForecastVerificationWidget } from '@/components/forecast/forecast-verification-widget';
import * as verificationActions from '@/actions/forecast-verification-actions';
import { useAuth } from '@/context/auth-context';

// Mock the verification actions
jest.mock('@/actions/forecast-verification-actions', () => ({
  voteForecastAccuracy: jest.fn(),
  getUserForecastVote: jest.fn(),
}));

jest.mock('@/context/auth-context');

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useDataFetcher to avoid real API calls
jest.mock('@/hooks/use-data-fetcher', () => ({
  useDataFetcher: jest.fn((fetchFn, options = {}) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(
      !(options && (options as any).skip)
    );
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      if (options && (options as any).skip) {
        setLoading(false);
        return;
      }

      fetchFn()
        .then((result: any) => {
          setData(result);
          setLoading(false);
        })
        .catch((err: any) => {
          setError(err instanceof Error ? err.message : err);
          setLoading(false);
        });
    }, [fetchFn, options]);

    return {
      data,
      loading,
      error,
      refetch: jest.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('ForecastVerificationWidget', () => {
  const defaultProps = {
    forecastId: 'test-forecast-id',
    beachId: 'test-beach-id',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      session: null,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
    (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
      success: true,
      data: null,
    });
  });

  describe('Initial Rendering', () => {
    it('renders loading state initially', () => {
      render(<ForecastVerificationWidget {...defaultProps} />);

      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loader icon
    });

    it('renders vote buttons after loading when no existing vote', async () => {
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /^Accurate$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Inaccurate$/i })).toBeInTheDocument();
    });

    it('shows help text when no vote has been submitted', async () => {
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/Help the community by verifying forecast accuracy/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error state when fetching existing vote fails', async () => {
      const { toast } = require('sonner');
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Unable to load your verification')
        ).toBeInTheDocument();
      });

      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Network error');
    });
  });

  describe('Authentication gating', () => {
    it('renders login prompt when user is not authenticated', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      expect(
        screen.getByText(
          /Sign in to vote on forecast accuracy, share notes, and help the community/i
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Sign In to Verify/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Join Quiver/i })
      ).toBeInTheDocument();
      expect(verificationActions.getUserForecastVote).not.toHaveBeenCalled();
    });
  });
  describe('Vote Selection', () => {
    it('highlights accurate button when clicked', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      expect(accurateButton).toHaveClass('bg-green-600');
    });

    it('highlights inaccurate button when clicked', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const inaccurateButton = screen.getByRole('button', { name: /^Inaccurate$/i });
      await user.click(inaccurateButton);

      expect(inaccurateButton).toHaveClass('bg-red-600');
    });

    it('allows toggling vote selection', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });

      // Click to select
      await user.click(accurateButton);
      expect(accurateButton).toHaveClass('bg-green-600');

      // Click again to deselect
      await user.click(accurateButton);
      expect(accurateButton).not.toHaveClass('bg-green-600');
    });

    it('switches between accurate and inaccurate votes', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      const inaccurateButton = screen.getByRole('button', { name: /^Inaccurate$/i });

      // Select accurate
      await user.click(accurateButton);
      expect(accurateButton).toHaveClass('bg-green-600');

      // Switch to inaccurate
      await user.click(inaccurateButton);
      expect(inaccurateButton).toHaveClass('bg-red-600');
      expect(accurateButton).not.toHaveClass('bg-green-600');
    });
  });

  describe('Notes Field', () => {
    it('shows notes field only after vote selection', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      // No notes field initially
      expect(screen.queryByLabelText(/Notes/i)).not.toBeInTheDocument();

      // Click accurate button
      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      // Notes field appears
      expect(screen.getByLabelText(/Notes \(optional\)/i)).toBeInTheDocument();
    });

    it('allows entering notes up to 500 characters', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const notesField = screen.getByLabelText(/Notes \(optional\)/i) as HTMLTextAreaElement;
      const testNotes = 'Waves were bigger than predicted, good offshore winds';

      await user.type(notesField, testNotes);

      expect(notesField.value).toBe(testNotes);
      expect(screen.getByText(`${testNotes.length}/500 characters`)).toBeInTheDocument();
    });

    it('enforces 500 character limit', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const notesField = screen.getByLabelText(/Notes \(optional\)/i) as HTMLTextAreaElement;

      expect(notesField).toHaveAttribute('maxLength', '500');
    });
  });

  describe('Form Submission', () => {
    it('shows submit button after vote selection', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      // No submit button initially
      expect(screen.queryByRole('button', { name: /Submit/i })).not.toBeInTheDocument();

      // Click accurate button
      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      // Submit button appears
      expect(screen.getByRole('button', { name: /Submit Verification/i })).toBeInTheDocument();
    });

    it('submits vote without notes successfully', async () => {
      const user = userEvent.setup();
      const mockVoteResponse = {
        success: true,
        data: { vote: { id: 'vote-id', was_accurate: true }, isUpdate: false },
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(verificationActions.voteForecastAccuracy).toHaveBeenCalledWith({
          forecastId: 'test-forecast-id',
          beachId: 'test-beach-id',
          wasAccurate: true,
          notes: undefined,
        });
      });
    });

    it('submits vote with notes successfully', async () => {
      const user = userEvent.setup();
      const mockVoteResponse = {
        success: true,
        data: { vote: { id: 'vote-id', was_accurate: true }, isUpdate: false },
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const notesField = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesField, 'Conditions were better than expected');

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(verificationActions.voteForecastAccuracy).toHaveBeenCalledWith({
          forecastId: 'test-forecast-id',
          beachId: 'test-beach-id',
          wasAccurate: true,
          notes: 'Conditions were better than expected',
        });
      });
    });

    it('trims whitespace from notes before submission', async () => {
      const user = userEvent.setup();
      const mockVoteResponse = {
        success: true,
        data: { vote: { id: 'vote-id', was_accurate: true }, isUpdate: false },
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const notesField = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesField, '   whitespace test   ');

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(verificationActions.voteForecastAccuracy).toHaveBeenCalledWith({
          forecastId: 'test-forecast-id',
          beachId: 'test-beach-id',
          wasAccurate: true,
          notes: 'whitespace test',
        });
      });
    });

    it('shows error toast when submission fails', async () => {
      const user = userEvent.setup();
      const { toast } = require('sonner');
      const mockVoteResponse = {
        success: false,
        error: 'Database error occurred',
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database error occurred');
      });
    });

    it('shows error when submitting without selecting a vote', async () => {
      const user = userEvent.setup();
      const { toast } = require('sonner');

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      // Try to submit the form without clicking a vote button
      const form = screen.getByRole('button', { name: /^Accurate$/i }).closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select whether the forecast was accurate');
      });
    });
  });

  describe('Existing Vote Handling', () => {
    it('loads and displays existing vote', async () => {
      const existingVote = {
        was_accurate: true,
        notes: 'Great forecast accuracy',
      };
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: true,
        data: existingVote,
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Your Verification')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      expect(accurateButton).toHaveClass('bg-green-600');

      const notesField = screen.getByLabelText(/Notes \(optional\)/i) as HTMLTextAreaElement;
      expect(notesField.value).toBe('Great forecast accuracy');
    });

    it('shows update button text when modifying existing vote', async () => {
      const existingVote = {
        was_accurate: true,
        notes: 'Original notes',
      };
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: true,
        data: existingVote,
      });

      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Your Verification')).toBeInTheDocument();
      });

      // Modify the notes
      const notesField = screen.getByLabelText(/Notes \(optional\)/i);
      await user.clear(notesField);
      await user.type(notesField, 'Updated notes');

      expect(screen.getByRole('button', { name: /Update Verification/i })).toBeInTheDocument();
    });

    it('shows verified badge when vote exists and is unchanged', async () => {
      const existingVote = {
        was_accurate: true,
        notes: 'Great forecast',
      };
      (verificationActions.getUserForecastVote as jest.Mock).mockResolvedValue({
        success: true,
        data: existingVote,
      });

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
      });

      const submitButton = screen.getByRole('button', { name: /^Verified$/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Callback Handling', () => {
    it('calls onVoteSuccess callback after successful submission', async () => {
      const user = userEvent.setup();
      const onVoteSuccess = jest.fn();
      const mockVoteResponse = {
        success: true,
        data: { vote: { id: 'vote-id', was_accurate: true }, isUpdate: false },
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} onVoteSuccess={onVoteSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onVoteSuccess).toHaveBeenCalled();
      });
    });

    it('does not call onVoteSuccess callback on failed submission', async () => {
      const user = userEvent.setup();
      const onVoteSuccess = jest.fn();
      const mockVoteResponse = {
        success: false,
        error: 'Submission failed',
      };
      (verificationActions.voteForecastAccuracy as jest.Mock).mockResolvedValue(mockVoteResponse);

      render(<ForecastVerificationWidget {...defaultProps} onVoteSuccess={onVoteSuccess} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onVoteSuccess).not.toHaveBeenCalled();
      });
    });
  });

  describe('Loading and Disabled States', () => {
    it('disables vote buttons during submission', async () => {
      const user = userEvent.setup();
      let resolveVote: any;
      const votePromise = new Promise((resolve) => {
        resolveVote = resolve;
      });
      (verificationActions.voteForecastAccuracy as jest.Mock).mockReturnValue(votePromise);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Submitting.../i })).toBeDisabled();
      });

      // Resolve the promise
      resolveVote({ success: true, data: {} });
    });

    it('shows loading spinner during submission', async () => {
      const user = userEvent.setup();
      let resolveVote: any;
      const votePromise = new Promise((resolve) => {
        resolveVote = resolve;
      });
      (verificationActions.voteForecastAccuracy as jest.Mock).mockReturnValue(votePromise);

      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      const submitButton = screen.getByRole('button', { name: /Submit Verification/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Submitting.../i)).toBeInTheDocument();
      });

      resolveVote({ success: true, data: {} });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', async () => {
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await userEvent.click(accurateButton);

      expect(screen.getByLabelText(/Notes \(optional\)/i)).toBeInTheDocument();
    });

    it('displays character count for notes field', async () => {
      const user = userEvent.setup();
      render(<ForecastVerificationWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Was this forecast accurate?')).toBeInTheDocument();
      });

      const accurateButton = screen.getByRole('button', { name: /^Accurate$/i });
      await user.click(accurateButton);

      expect(screen.getByText('0/500 characters')).toBeInTheDocument();

      const notesField = screen.getByLabelText(/Notes \(optional\)/i);
      await user.type(notesField, 'Test');

      expect(screen.getByText('4/500 characters')).toBeInTheDocument();
    });
  });
});
