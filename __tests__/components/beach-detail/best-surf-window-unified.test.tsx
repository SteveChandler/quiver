import { render, screen } from '@testing-library/react';
import { BestSurfWindow } from '@/components/beach-detail/best-surf-window';
import type { SurfCallResult } from '@/lib/utils/surf-call-logic';

// Mock the data fetcher and related hooks
jest.mock('@/hooks/use-data-fetcher', () => ({
  useDataFetcher: jest.fn(() => ({
    data: null,
    loading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/use-magic-hour', () => ({
  useMagicHour: jest.fn(() => ({
    magicHour: null,
    isLoading: false,
  })),
}));

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/ca/san-diego/ocean-beach'),
}));

describe('BestSurfWindow - Unified Card Integration', () => {
  const mockBeachId = 'test-beach-123';
  const mockBeachName = 'Ocean Beach';
  const mockTimezone = 'America/Los_Angeles';

  describe('when surfCall is provided with valid window', () => {
    const mockSurfCall: SurfCallResult = {
      verdict: 'YES',
      bestWindowStart: '2026-01-24T15:00:00Z',
      bestWindowEnd: '2026-01-24T19:30:00Z',
      windowMinutes: 270,
      shortWindow: false,
      waveHeight: '1.7 ft',
      windDescription: 'NW 10-15 mph (offshore)',
      windSpeed: '10-15 mph',
      windCompass: 'NW',
      windType: 'offshore',
      tideDescription: 'Rising',
      tidePhase: 'rising',
      tideHeight: null,
      nextTideType: 'high',
      nextTideAt: '2026-01-24T20:00:00Z',
      whySentence: 'Rideable surf with improving conditions through the afternoon.',
      forecastConfidence: 65,
      lowForecastConfidence: false,
      score: 75,
      peakTime: '2026-01-24T18:30:00Z',
      trendTags: ['Winds Cleaning Up', 'Tide Filling In', 'Clean Swell'],
      updatedAt: '2026-01-24T09:34:00Z',
      isCalibrated: true,
    };

    it('should render the unified card instead of legacy components', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockSurfCall}
        />
      );

      // Should show the card title
      expect(screen.getByText(/Best Time to Surf Today/i)).toBeInTheDocument();
    });

    it('should display trend tags as colored chips', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockSurfCall}
        />
      );

      expect(screen.getByText('Winds Cleaning Up')).toBeInTheDocument();
      expect(screen.getByText('Tide Filling In')).toBeInTheDocument();
      expect(screen.getByText('Clean Swell')).toBeInTheDocument();
    });

    it('should display peak time when available', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockSurfCall}
        />
      );

      // For windows > 3 hours, shows "Best at X" with peak time
      expect(screen.getByText(/Best at/i)).toBeInTheDocument();
    });

    it('should show the why sentence as the narrative', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockSurfCall}
        />
      );

      expect(
        screen.getByText(/Rideable surf with improving conditions through the afternoon/i)
      ).toBeInTheDocument();
    });

    it('should display key conditions (wave height, wind, tide)', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockSurfCall}
        />
      );

      // WaveHeightDisplay renders a range (low → set waves via SET_WAVE_VARIANCE),
      // so we assert the primary-wave-height anchor rather than the literal input.
      expect(screen.getByTestId('primary-wave-height')).toBeInTheDocument();
      expect(screen.getByText(/NW 10-15 mph/i)).toBeInTheDocument();
      expect(screen.getByText(/Rising/i)).toBeInTheDocument();
    });
  });

  describe('when surfCall has NO verdict', () => {
    const mockNoSurfCall: SurfCallResult = {
      verdict: 'NO',
      bestWindowStart: null,
      bestWindowEnd: null,
      windowMinutes: null,
      shortWindow: false,
      waveHeight: null,
      windDescription: null,
      windSpeed: null,
      windCompass: null,
      windType: null,
      tideDescription: null,
      tidePhase: null,
      tideHeight: null,
      nextTideType: null,
      nextTideAt: null,
      whySentence: 'Conditions not favorable for surfing.',
      forecastConfidence: 40,
      lowForecastConfidence: false,
      score: 30,
      peakTime: null,
      trendTags: [],
      updatedAt: '2026-01-24T09:34:00Z',
      isCalibrated: true,
    };

    it('should show appropriate message when no good window exists', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockNoSurfCall}
        />
      );

      expect(
        screen.getByText(/Conditions not favorable for surfing/i)
      ).toBeInTheDocument();
    });
  });

  describe('when surfCall has low forecast confidence', () => {
    const mockLowConfidenceSurfCall: SurfCallResult = {
      verdict: 'MAYBE',
      bestWindowStart: '2026-01-24T15:00:00Z',
      bestWindowEnd: '2026-01-24T19:30:00Z',
      windowMinutes: 270,
      shortWindow: false,
      waveHeight: '1.5 ft',
      windDescription: 'NW 8 mph (offshore)',
      windSpeed: '8 mph',
      windCompass: 'NW',
      windType: 'offshore',
      tideDescription: 'Rising',
      tidePhase: 'rising',
      tideHeight: null,
      nextTideType: 'high',
      nextTideAt: '2026-01-24T20:00:00Z',
      whySentence: 'Modest conditions - keep an eye on conditions.',
      forecastConfidence: 25,
      lowForecastConfidence: true,
      score: 55,
      peakTime: '2026-01-24T17:00:00Z',
      trendTags: ['Tide Filling In'],
      updatedAt: '2026-01-24T09:34:00Z',
      isCalibrated: true,
    };

    it('should display safe mode badge when confidence is low', () => {
      render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={mockLowConfidenceSurfCall}
        />
      );

      expect(screen.getByText(/Low Confidence/i)).toBeInTheDocument();
    });
  });

  describe('when surfCall is null/undefined (legacy fallback)', () => {
    it('should render without crashing when surfCall is null', () => {
      const { container } = render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
          surfCall={null}
        />
      );

      // Just verify it renders something (legacy behavior)
      expect(container).toBeInTheDocument();
    });

    it('should render without crashing when surfCall is undefined', () => {
      const { container } = render(
        <BestSurfWindow
          beachId={mockBeachId}
          beachName={mockBeachName}
          beachTimezone={mockTimezone}
        />
      );

      // Just verify it renders something (legacy behavior)
      expect(container).toBeInTheDocument();
    });
  });
});
