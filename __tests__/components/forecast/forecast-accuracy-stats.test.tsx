import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ForecastAccuracyStats } from '@/components/forecast/forecast-accuracy-stats';
import * as verificationActions from '@/actions/forecast-verification-actions';
import { useAuth } from '@/context/auth-context';

// Mock the verification actions
jest.mock('@/actions/forecast-verification-actions', () => ({
  getBeachAccuracyStats: jest.fn(),
}));

jest.mock('@/context/auth-context');

// Mock useDataFetcher
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

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetBeachAccuracyStats =
  verificationActions.getBeachAccuracyStats as jest.MockedFunction<
    typeof verificationActions.getBeachAccuracyStats
  >;

const resolveStats = (data: any) =>
  mockGetBeachAccuracyStats.mockResolvedValue({ success: true, data });

const getCircleElement = (percentage: string) =>
  screen.getByText(percentage).parentElement?.parentElement as HTMLElement;

describe('ForecastAccuracyStats', () => {
  const defaultProps = {
    beachId: 'test-beach-id',
  };

  const mockStatsData = {
    beach_id: 'test-beach-id',
    total_votes: 100,
    accurate_votes: 75,
    inaccurate_votes: 25,
    accuracy_percentage: 75.0,
    recent_votes: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
  });

  describe('Loading State', () => {
    it('renders loading spinner initially', () => {
      mockGetBeachAccuracyStats.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      render(<ForecastAccuracyStats {...defaultProps} />);

      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loader2 icon
    });
  });

  describe('Error State', () => {
    it('displays error message when fetch fails', async () => {
      mockGetBeachAccuracyStats.mockRejectedValue(
        new Error('Failed to load stats')
      );

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load statistics')).toBeInTheDocument();
      });
    });

    it('shows AlertCircle icon in error state', async () => {
      mockGetBeachAccuracyStats.mockRejectedValue(
        new Error('Network error')
      );

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const card = screen.getByText('Failed to load statistics').closest('div');
        expect(card?.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication gating', () => {
    it('renders login prompt when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      });

      render(<ForecastAccuracyStats {...defaultProps} />);

      expect(
        screen.getByText('Sign in to view community verification stats')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Sign In/i })
      ).toBeInTheDocument();
      expect(mockGetBeachAccuracyStats).not.toHaveBeenCalled();
    });
  });

  describe('No Data State', () => {
    it('displays empty state when no votes exist', async () => {
      resolveStats(null);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No verifications yet')).toBeInTheDocument();
        expect(screen.getByText('Be the first to verify forecast accuracy!')).toBeInTheDocument();
      });
    });

    it('displays empty state when total_votes is 0', async () => {
      const emptyStats = {
        ...mockStatsData,
        total_votes: 0,
        accurate_votes: 0,
        inaccurate_votes: 0,
        accuracy_percentage: 0,
      };
      resolveStats(emptyStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No verifications yet')).toBeInTheDocument();
      });
    });

    it('shows Users icon in empty state', async () => {
      resolveStats(null);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const emptyState = screen.getByText('No verifications yet').closest('div');
        expect(emptyState?.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays accuracy percentage correctly', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('75%')).toBeInTheDocument();
        expect(screen.getByText('Overall Accuracy')).toBeInTheDocument();
      });
    });

    it('displays accurate vote count', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('75')).toBeInTheDocument();
        expect(screen.getByText('Accurate')).toBeInTheDocument();
      });
    });

    it('displays inaccurate vote count', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('25')).toBeInTheDocument();
        expect(screen.getByText('Inaccurate')).toBeInTheDocument();
      });
    });

    it('displays total verifications count with plural', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Based on/)).toBeInTheDocument();
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText(/verifications/)).toBeInTheDocument();
      });
    });

    it('uses singular "verification" for single vote', async () => {
      const singleVoteStats = {
        ...mockStatsData,
        total_votes: 1,
        accurate_votes: 1,
        inaccurate_votes: 0,
        accuracy_percentage: 100.0,
      };
      resolveStats(singleVoteStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/verification$/)).toBeInTheDocument();
      });
    });

    it('displays time window badge', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} daysBack={30} />);

      await waitFor(() => {
        expect(screen.getByText('Last 30 days')).toBeInTheDocument();
      });
    });

    it('respects custom daysBack parameter', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} daysBack={7} />);

      await waitFor(() => {
        expect(screen.getByText('Last 7 days')).toBeInTheDocument();
      });
    });
  });

  describe('Accuracy Level Styling', () => {
    it('applies high accuracy styling for >= 75%', async () => {
      const highAccuracyStats = {
        ...mockStatsData,
        accuracy_percentage: 80.0,
      };
      resolveStats(highAccuracyStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const percentageCircle = getCircleElement('80%');
        expect(percentageCircle).toHaveClass(
          'text-green-700',
          'bg-green-50',
          'border-green-200'
        );
      });
    });

    it('applies medium accuracy styling for 50-74%', async () => {
      const mediumAccuracyStats = {
        ...mockStatsData,
        accurate_votes: 60,
        inaccurate_votes: 40,
        accuracy_percentage: 60.0,
      };
      resolveStats(mediumAccuracyStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const percentageCircle = getCircleElement('60%');
        expect(percentageCircle).toHaveClass(
          'text-yellow-700',
          'bg-yellow-50',
          'border-yellow-200'
        );
      });
    });

    it('applies low accuracy styling for < 50%', async () => {
      const lowAccuracyStats = {
        ...mockStatsData,
        accurate_votes: 40,
        inaccurate_votes: 60,
        accuracy_percentage: 40.0,
      };
      resolveStats(lowAccuracyStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const percentageCircle = getCircleElement('40%');
        expect(percentageCircle).toHaveClass(
          'text-red-700',
          'bg-red-50',
          'border-red-200'
        );
      });
    });

    it('applies correct styling at accuracy thresholds', async () => {
      // Test at 75% threshold
      const thresholdStats = {
        ...mockStatsData,
        accuracy_percentage: 75.0,
      };
      resolveStats(thresholdStats);

      const { rerender } = render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const circle = getCircleElement('75%');
        expect(circle).toHaveClass('bg-green-50'); // Should be high
      });

      // Test at 50% threshold
      const mediumThresholdStats = {
        ...mockStatsData,
        accuracy_percentage: 50.0,
      };
      resolveStats(mediumThresholdStats);

      rerender(<ForecastAccuracyStats beachId="test-beach-id-2" />);

      await waitFor(() => {
        const circle = getCircleElement('50%');
        expect(circle).toHaveClass('bg-yellow-50'); // Should be medium
      });
    });
  });

  describe('Compact Mode', () => {
    it('renders compact badge view when compact prop is true', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} compact={true} />);

      await waitFor(() => {
        expect(screen.getByText('75% Accurate')).toBeInTheDocument();
        expect(screen.getByText('(100 votes)')).toBeInTheDocument();
      });
    });

    it('shows singular vote in compact mode', async () => {
      const singleVoteStats = {
        ...mockStatsData,
        total_votes: 1,
        accurate_votes: 1,
        inaccurate_votes: 0,
        accuracy_percentage: 100.0,
      };
      resolveStats(singleVoteStats);

      render(<ForecastAccuracyStats {...defaultProps} compact={true} />);

      await waitFor(() => {
        expect(screen.getByText('(1 vote)')).toBeInTheDocument();
      });
    });

    it('applies correct color to compact badge', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} compact={true} />);

      await waitFor(() => {
        const badge = screen.getByText('75% Accurate').closest('div');
        expect(badge).toHaveClass('text-green-700', 'bg-green-50', 'border-green-200');
      });
    });

    it('shows TrendingUp icon in compact mode', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} compact={true} />);

      await waitFor(() => {
        const badge = screen.getByText('75% Accurate').closest('div');
        expect(badge?.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('does not render card structure in compact mode', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} compact={true} />);

      await waitFor(() => {
        expect(screen.queryByText('Community Accuracy')).not.toBeInTheDocument();
        expect(screen.queryByText('Overall Accuracy')).not.toBeInTheDocument();
      });
    });
  });

  describe('Full Mode', () => {
    it('renders full card view by default', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Community Accuracy')).toBeInTheDocument();
        expect(screen.getByText('Overall Accuracy')).toBeInTheDocument();
      });
    });

    it('displays vote breakdown in separate sections', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        // Accurate section
        const accurateSection = screen.getByText('Accurate').closest('div');
        expect(accurateSection).toHaveClass('bg-green-50', 'border-green-200');
        expect(screen.getByText('75')).toBeInTheDocument();

        // Inaccurate section
        const inaccurateSection = screen.getByText('Inaccurate').closest('div');
        expect(inaccurateSection).toHaveClass('bg-red-50', 'border-red-200');
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });

    it('shows CheckCircle icon for accurate votes', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const accurateSection = screen.getByText('Accurate').closest('div');
        expect(accurateSection?.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('shows XCircle icon for inaccurate votes', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        const inaccurateSection = screen.getByText('Inaccurate').closest('div');
        expect(inaccurateSection?.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Styling', () => {
    it('applies custom className', async () => {
      resolveStats(mockStatsData);

      const { container } = render(
        <ForecastAccuracyStats {...defaultProps} className="custom-stats-class" />
      );

      await waitFor(() => {
        expect(container.querySelector('.custom-stats-class')).toBeInTheDocument();
      });
    });

    it('applies custom className in compact mode', async () => {
      resolveStats(mockStatsData);

      const { container } = render(
        <ForecastAccuracyStats {...defaultProps} compact={true} className="compact-custom" />
      );

      await waitFor(() => {
        expect(container.querySelector('.compact-custom')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles 100% accuracy correctly', async () => {
      const perfectStats = {
        ...mockStatsData,
        accurate_votes: 50,
        inaccurate_votes: 0,
        accuracy_percentage: 100.0,
      };
      resolveStats(perfectStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('100%')).toBeInTheDocument();
        expect(screen.getByText('50')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    it('handles 0% accuracy correctly', async () => {
      const zeroStats = {
        ...mockStatsData,
        accurate_votes: 0,
        inaccurate_votes: 50,
        accuracy_percentage: 0.0,
      };
      resolveStats(zeroStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('0%')).toBeInTheDocument();
        expect(screen.getAllByText('0')[0]).toBeInTheDocument(); // accurate votes
        expect(screen.getByText('50')).toBeInTheDocument(); // inaccurate votes
      });
    });

    it('handles decimal accuracy percentages', async () => {
      const decimalStats = {
        ...mockStatsData,
        accuracy_percentage: 67.5,
      };
      resolveStats(decimalStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('67.5%')).toBeInTheDocument();
      });
    });

    it('handles large vote counts', async () => {
      const largeStats = {
        ...mockStatsData,
        total_votes: 10000,
        accurate_votes: 7500,
        inaccurate_votes: 2500,
        accuracy_percentage: 75.0,
      };
      resolveStats(largeStats);

      render(<ForecastAccuracyStats {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('10000')).toBeInTheDocument();
        expect(screen.getByText('7500')).toBeInTheDocument();
        expect(screen.getByText('2500')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('fetches stats with correct beachId and default daysBack', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats beachId="custom-beach-123" />);

      await waitFor(() => {
        expect(verificationActions.getBeachAccuracyStats).toHaveBeenCalledWith(
          'custom-beach-123',
          30
        );
      });
    });

    it('fetches stats with custom daysBack parameter', async () => {
      resolveStats(mockStatsData);

      render(<ForecastAccuracyStats beachId="test-beach" daysBack={14} />);

      await waitFor(() => {
        expect(verificationActions.getBeachAccuracyStats).toHaveBeenCalledWith('test-beach', 14);
      });
    });
  });
});
