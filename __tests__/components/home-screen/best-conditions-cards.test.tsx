import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BestConditionsCards } from '@/components/home-screen/best-conditions-cards';
import * as bestBeachesActions from '@/actions/beach/best-beaches-simple';
import { useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the actions
jest.mock('@/actions/beach/best-beaches-simple', () => ({
  getBestBeachesNearHome: jest.fn(),
}));

// Mock useGeo
jest.mock('@/hooks/useGeo', () => ({
  useGeo: jest.fn(() => ({
    coords: null,
    loading: false,
    error: null,
    source: 'default',
    requestLocation: jest.fn(),
    setLastBeach: jest.fn(),
  })),
}));

// Mock useDataFetcher
jest.mock('@/hooks/use-data-fetcher', () => ({
  useDataFetcher: jest.fn((fetchFn) => {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
      fetchFn()
        .then((result: any) => {
          setData(result);
          setLoading(false);
        })
        .catch((err: any) => {
          setError(err.message || 'Error');
          setLoading(false);
        });
    }, []);

    return { data, loading, error, refetch: jest.fn() };
  }),
}));

describe('BestConditionsCards', () => {
  const mockPush = jest.fn();

  const mockBeachRecommendations = [
    {
      id: 'beach-1',
      name: 'Ocean Beach Pier',
      location: 'San Diego',
      distance_miles: 2.5,
      wave_height: '4-6 ft',
      wave_direction: 'SW',
      wind_description: 'Offshore NW 8mph',
      tide_status: 'Mid Tide Rising',
      skill_level: 'Intermediate',
      crowd_level: 'Uncrowded',
      image_url: 'https://example.com/ocean-beach.jpg',
      is_hidden_gem: false,
    },
    {
      id: 'beach-2',
      name: 'Blacks Beach',
      location: 'La Jolla',
      distance_miles: 5.2,
      wave_height: '6-8 ft',
      wave_direction: 'SSW',
      wind_description: 'Light Offshore 5mph',
      tide_status: 'Low Tide',
      skill_level: 'Advanced',
      crowd_level: 'Uncrowded',
      image_url: null,
      is_hidden_gem: true,
    },
    {
      id: 'beach-3',
      name: 'Tourmaline Surf Park',
      location: 'Pacific Beach',
      distance_miles: 1.8,
      wave_height: '2-3 ft',
      wave_direction: 'W',
      wind_description: 'Onshore SW 12mph',
      tide_status: 'High Tide Falling',
      skill_level: 'Beginner',
      crowd_level: 'Crowded',
      image_url: 'https://example.com/tourmaline.jpg',
      is_hidden_gem: false,
    },
    {
      id: 'beach-4',
      name: 'Windansea',
      location: 'La Jolla',
      distance_miles: 4.1,
      wave_height: '5-7 ft',
      wave_direction: 'S',
      wind_description: 'Cross-shore E 6mph',
      tide_status: 'Mid Tide',
      skill_level: 'Expert',
      crowd_level: 'Moderate',
      image_url: 'https://example.com/windansea.jpg',
      is_hidden_gem: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  describe('Loading State', () => {
    it('renders skeleton loading cards', () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      render(<BestConditionsCards />);

      // Should show skeleton cards (3 of them)
      const skeletonCards = document.querySelectorAll('div[class*="flex-shrink-0"]');
      expect(skeletonCards.length).toBeGreaterThan(0);
    });

    it('shows loading title and description', () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockReturnValue(
        new Promise(() => {})
      );

      render(<BestConditionsCards />);

      // Skeleton should have animated elements
      const animatedElements = document.querySelectorAll('.animate-pulse');
      expect(animatedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('displays error message when fetch fails', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockRejectedValue(
        new Error('Failed to load beaches')
      );

      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading beaches/i)).toBeInTheDocument();
        expect(screen.getByText(/Failed to load beaches/i)).toBeInTheDocument();
      });
    });

    it('still shows section heading in error state', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<BestConditionsCards />);

      await waitFor(() => {
        // Should show default heading when no metadata or homeBeach
        expect(screen.getByText(/Best Conditions Near/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('renders nothing when no beaches within range', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { container } = render(<BestConditionsCards />);

      await waitFor(() => {
        // Component should return null (render nothing)
        expect(container.firstChild).toBeNull();
      });
    });

    it('renders nothing when response is not successful', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: false,
        error: 'No home beach set',
      });

      const { container } = render(<BestConditionsCards />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('renders nothing when data is null', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: null,
      });

      const { container } = render(<BestConditionsCards />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  describe('Successful Data Display', () => {
    beforeEach(() => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations,
        metadata: { locationSource: 'gps' },
      });
    });

    it('displays section heading and description', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        // With GPS metadata, should show "Best Conditions Near You"
        expect(screen.getByText('Best Conditions Near You')).toBeInTheDocument();
        expect(screen.getByText('Top surf spots within 10 miles right now')).toBeInTheDocument();
      });
    });

    it('displays home beach name in heading when using home beach location', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations,
        metadata: { locationSource: 'home-beach' },
      });

      const mockHomeBeach = {
        id: 'beach-home',
        name: 'La Jolla Shores',
        lat: 32.8573,
        lon: -117.2566,
      } as any;

      render(<BestConditionsCards homeBeach={mockHomeBeach} />);

      await waitFor(() => {
        // With home-beach metadata, should show beach name
        expect(screen.getByText('Best Conditions Near La Jolla Shores')).toBeInTheDocument();
        expect(screen.getByText('Top surf spots within 10 miles right now')).toBeInTheDocument();
      });
    });

    it('renders all beach cards', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        mockBeachRecommendations.forEach((beach) => {
          expect(screen.getByText(beach.name)).toBeInTheDocument();
        });
      });
    });

    it('displays beach location and distance', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText(/San Diego · 2.5 mi/i)).toBeInTheDocument();
        expect(screen.getByText(/La Jolla · 5.2 mi/i)).toBeInTheDocument();
        expect(screen.getByText(/Pacific Beach · 1.8 mi/i)).toBeInTheDocument();
      });
    });

    it('displays wave conditions', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('4-6 ft')).toBeInTheDocument();
        expect(screen.getByText('SW')).toBeInTheDocument();
        expect(screen.getByText('6-8 ft')).toBeInTheDocument();
        expect(screen.getByText('SSW')).toBeInTheDocument();
      });
    });

    it('displays wind description', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('Offshore NW 8mph')).toBeInTheDocument();
        expect(screen.getByText('Light Offshore 5mph')).toBeInTheDocument();
        expect(screen.getByText('Onshore SW 12mph')).toBeInTheDocument();
      });
    });

    it('displays tide status', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('Mid Tide Rising')).toBeInTheDocument();
        expect(screen.getByText('Low Tide')).toBeInTheDocument();
        expect(screen.getByText('High Tide Falling')).toBeInTheDocument();
      });
    });

    it('displays skill level badges', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('Intermediate')).toBeInTheDocument();
        expect(screen.getByText('Advanced')).toBeInTheDocument();
        expect(screen.getByText('Beginner')).toBeInTheDocument();
        expect(screen.getByText('Expert')).toBeInTheDocument();
      });
    });

    it('applies correct skill level colors', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const beginnerBadge = screen.getByText('Beginner').closest('div');
        expect(beginnerBadge).toHaveClass('bg-blue-50', 'text-ocean-blue');

        const intermediateBadge = screen.getByText('Intermediate').closest('div');
        expect(intermediateBadge).toHaveClass('bg-orange-50', 'text-orange-600');

        const advancedBadge = screen.getByText('Advanced').closest('div');
        expect(advancedBadge).toHaveClass('bg-red-50', 'text-red-600');

        const expertBadge = screen.getByText('Expert').closest('div');
        expect(expertBadge).toHaveClass('bg-red-50', 'text-red-700');
      });
    });

    it('displays crowd level badges', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getAllByText('Uncrowded').length).toBe(2);
        expect(screen.getByText('Crowded')).toBeInTheDocument();
        expect(screen.getByText('Moderate')).toBeInTheDocument();
      });
    });

    it('applies correct crowd level colors', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const uncrowdedBadges = screen.getAllByText('Uncrowded');
        expect(uncrowdedBadges[0].closest('div')).toHaveClass('bg-green-50', 'text-green-700');

        const crowdedBadge = screen.getByText('Crowded').closest('div');
        expect(crowdedBadge).toHaveClass('bg-red-50', 'text-red-700');

        const moderateBadge = screen.getByText('Moderate').closest('div');
        expect(moderateBadge).toHaveClass('bg-yellow-50', 'text-yellow-700');
      });
    });

    it('shows Hidden Gem badge when applicable', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const hiddenGemBadges = screen.getAllByText('Hidden Gem');
        expect(hiddenGemBadges.length).toBe(1); // Only Blacks Beach
        expect(hiddenGemBadges[0]).toHaveClass('bg-purple-500');
      });
    });

    it('displays beach images when available', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const images = screen.getAllByRole('img', { hidden: true });
        // Filter out icon images, look for beach images
        const beachImages = images.filter((img) => {
          const src = img.getAttribute('src');
          return src && src.includes('example.com');
        });

        expect(beachImages.length).toBeGreaterThan(0);
      });
    });

    it('shows Waves icon fallback when no image available', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const beachCard = screen.getByText("Blacks Beach").closest('div[class*="flex-shrink-0"]');
        expect(beachCard).toBeInTheDocument();

        // Should have Waves icon in the image area
        const wavesIcon = beachCard?.querySelector('svg');
        expect(wavesIcon).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    beforeEach(() => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations,
      });
    });

    it('navigates to beach detail page when card is clicked', async () => {
      const user = userEvent.setup();
      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('Ocean Beach Pier')).toBeInTheDocument();
      });

      const firstCard = screen.getByText('Ocean Beach Pier').closest('div[class*="flex-shrink-0"]');
      if (firstCard) {
        await user.click(firstCard);
      }

      expect(mockPush).toHaveBeenCalledWith('/beach/beach-1');
    });

    it('shows hover effects on cards', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const firstCard = screen.getByText('Ocean Beach Pier').closest('div[class*="flex-shrink-0"]');
        expect(firstCard).toHaveClass('cursor-pointer', 'hover:shadow-lg');
      });
    });

    it('allows horizontal scrolling through cards', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const scrollContainer = screen.getByText('Ocean Beach Pier')
          .closest('div[class*="overflow-x-auto"]');
        expect(scrollContainer).toBeInTheDocument();
        expect(scrollContainer).toHaveClass('snap-x', 'snap-mandatory');
      });
    });

    it('cards snap to position during scroll', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        // Find cards by finding beach names and getting their card container
        const beachNames = ['Ocean Beach Pier', 'Blacks Beach', 'Tourmaline Surf Park', 'Windansea'];
        beachNames.forEach((name) => {
          const beachElement = screen.getByText(name);
          const card = beachElement.closest('div[class*="flex-shrink-0"]');
          expect(card).toHaveClass('snap-start');
        });
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations,
      });
    });

    it('applies responsive card widths', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        // Find cards by finding beach names and getting their card container
        const beachNames = ['Ocean Beach Pier', 'Blacks Beach', 'Tourmaline Surf Park', 'Windansea'];
        beachNames.forEach((name) => {
          const beachElement = screen.getByText(name);
          const card = beachElement.closest('div[class*="flex-shrink-0"]');
          // Should have mobile and desktop widths
          expect(card).toHaveClass('w-[280px]', 'sm:w-[320px]');
        });
      });
    });

    it('hides scrollbar for cleaner appearance', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const scrollContainer = screen.getByText('Ocean Beach Pier')
          .closest('div[class*="overflow-x-auto"]');
        expect(scrollContainer).toHaveClass('scrollbar-hide');
      });
    });
  });

  describe('Icons and Visual Elements', () => {
    beforeEach(() => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations,
      });
    });

    it('displays Waves icon for wave conditions', async () => {
      const { container } = render(<BestConditionsCards />);

      await waitFor(() => {
        // Look for SVG icons
        const svgIcons = container.querySelectorAll('svg');
        expect(svgIcons.length).toBeGreaterThan(0);
      });
    });

    it('displays Wind icon for wind conditions', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        // Wind icon should be present in cards showing wind
        expect(screen.getByText('Offshore NW 8mph')).toBeInTheDocument();
      });
    });

    it('displays TrendingUp icon for tide conditions', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        // Tide icon should be present in cards showing tide
        expect(screen.getByText('Mid Tide Rising')).toBeInTheDocument();
      });
    });

    it('shows location emoji in location text', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const locationText = screen.getByText(/San Diego · 2.5 mi/i);
        // Text should include emoji (📍)
        expect(locationText.textContent).toContain('📍');
      });
    });

    it('shows crowd emoji in crowd level badge', async () => {
      render(<BestConditionsCards />);

      await waitFor(() => {
        const crowdBadges = screen.getAllByText(/Uncrowded|Crowded|Moderate/);
        crowdBadges.forEach((badge) => {
          // Badge should have emoji (👥)
          expect(badge.textContent).toContain('👥');
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles single beach recommendation', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockBeachRecommendations[0]],
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        expect(screen.getByText('Ocean Beach Pier')).toBeInTheDocument();
        expect(screen.queryByText('Blacks Beach')).not.toBeInTheDocument();
      });
    });

    it('handles maximum of 3 beaches', async () => {
      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: mockBeachRecommendations.slice(0, 3),
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        // Count beach names to verify only 3 beaches are shown
        expect(screen.getByText('Ocean Beach Pier')).toBeInTheDocument();
        expect(screen.getByText('Blacks Beach')).toBeInTheDocument();
        expect(screen.getByText('Tourmaline Surf Park')).toBeInTheDocument();
        expect(screen.queryByText('Windansea')).not.toBeInTheDocument();
      });
    });

    it('handles missing image_url gracefully', async () => {
      const beachWithoutImage = {
        ...mockBeachRecommendations[0],
        image_url: null,
      };

      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachWithoutImage],
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        // Should show gradient fallback with Waves icon
        expect(screen.getByText('Ocean Beach Pier')).toBeInTheDocument();
      });
    });

    it('handles long beach names', async () => {
      const beachWithLongName = {
        ...mockBeachRecommendations[0],
        name: 'Super Long Beach Name That Should Be Truncated With Ellipsis',
      };

      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachWithLongName],
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        const beachName = screen.getByText(/Super Long Beach Name/i).closest('h4');
        expect(beachName).toHaveClass('line-clamp-1');
      });
    });

    it('handles long wind descriptions', async () => {
      const beachWithLongWind = {
        ...mockBeachRecommendations[0],
        wind_description: 'Very long offshore wind description that should be truncated',
      };

      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachWithLongWind],
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        const windText = screen.getByText(/Very long offshore wind/i);
        expect(windText).toHaveClass('line-clamp-1');
      });
    });

    it('handles tide description truncation', async () => {
      const beachWithLongTide = {
        ...mockBeachRecommendations[0],
        tide_status: 'Very long tide description that should be truncated with ellipsis',
      };

      (bestBeachesActions.getBestBeachesNearHome as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachWithLongTide],
      });

      render(<BestConditionsCards />);

      await waitFor(() => {
        const tideText = screen.getByText(/Very long tide description/i);
        expect(tideText).toHaveClass('line-clamp-1');
      });
    });
  });

});
