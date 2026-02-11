/**
 * Unit Tests for NearbySpotsSsr Component
 *
 * Tests the server-side rendered nearby spots section:
 * - Null rendering for empty/undefined data
 * - Heading and beach card rendering
 * - Beach URL generation with fallback
 * - Location display (city/state handling)
 * - Distance formatting
 * - Custom className application
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NearbySpotsSsr } from '@/components/beach-detail/nearby-spots-server';
import type { Beach } from '@/types/database';

// Mock beach URL utils
jest.mock('@/lib/utils/beach-url-utils', () => ({
  getBeachUrlSafe: jest.fn((beach) => {
    if (!beach.slug) return null;
    return `/ca/${beach.city?.toLowerCase().replace(/\s+/g, '-')}/${beach.slug}`;
  }),
}));

// Mock distance utils
jest.mock('@/lib/utils/distance-utils', () => ({
  formatDistanceDisplay: jest.fn((distance, format) => {
    if (distance === undefined || distance === null) return null;
    return `${distance.toFixed(1)} mi`;
  }),
}));

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: jest.fn((...args) => args.filter(Boolean).join(' ')),
}));

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href, className }: any) => {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  };
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  MapPin: ({ className }: any) => <svg data-testid="map-pin-icon" className={className} />,
  ChevronRight: ({ className }: any) => <svg data-testid="chevron-right-icon" className={className} />,
}));

interface NearbyBeach extends Beach {
  distance?: number;
}

/**
 * Mock factory for creating nearby beach objects
 */
function createMockNearbyBeach(overrides: Partial<NearbyBeach> = {}): NearbyBeach {
  return {
    id: 'beach-1',
    name: 'Test Beach',
    slug: 'test-beach',
    city: 'San Diego',
    state: 'CA',
    distance: 2.5,
    center_lat: 32.8,
    center_lng: -117.2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as NearbyBeach;
}

describe('NearbySpotsSsr Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Null Rendering', () => {
    it('returns null for empty array', () => {
      const { container } = render(<NearbySpotsSsr nearbyBeaches={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for undefined nearbyBeaches', () => {
      const { container } = render(<NearbySpotsSsr nearbyBeaches={undefined as any} />);
      expect(container.firstChild).toBeNull();
    });

    it('does not render heading when no beaches', () => {
      render(<NearbySpotsSsr nearbyBeaches={[]} />);
      expect(screen.queryByText('Nearby Surf Spots')).not.toBeInTheDocument();
    });
  });

  describe('Rendering with Data', () => {
    it('renders heading "Nearby Surf Spots"', () => {
      const beaches = [createMockNearbyBeach()];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent('Nearby Surf Spots');
    });

    it('renders correct number of beach cards', () => {
      const beaches = [
        createMockNearbyBeach({ id: 'beach-1', name: 'Beach One', slug: 'beach-one' }),
        createMockNearbyBeach({ id: 'beach-2', name: 'Beach Two', slug: 'beach-two' }),
        createMockNearbyBeach({ id: 'beach-3', name: 'Beach Three', slug: 'beach-three' }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('Beach One')).toBeInTheDocument();
      expect(screen.getByText('Beach Two')).toBeInTheDocument();
      expect(screen.getByText('Beach Three')).toBeInTheDocument();
    });

    it('renders beach name as h3', () => {
      const beaches = [createMockNearbyBeach({ name: 'La Jolla Shores' })];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const beachName = screen.getByRole('heading', { level: 3 });
      expect(beachName).toHaveTextContent('La Jolla Shores');
    });

    it('renders MapPin and ChevronRight icons for each card', () => {
      const beaches = [
        createMockNearbyBeach({ id: 'beach-1' }),
        createMockNearbyBeach({ id: 'beach-2' }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const mapPinIcons = screen.getAllByTestId('map-pin-icon');
      const chevronIcons = screen.getAllByTestId('chevron-right-icon');

      expect(mapPinIcons).toHaveLength(2);
      expect(chevronIcons).toHaveLength(2);
    });
  });

  describe('Beach URL Linking', () => {
    it('links via getBeachUrlSafe when slug is present', () => {
      const beaches = [
        createMockNearbyBeach({
          id: 'beach-1',
          slug: 'ocean-beach',
          city: 'San Diego',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/ca/san-diego/ocean-beach');
    });

    it('uses fallback URL when getBeachUrlSafe returns null', () => {
      const beaches = [
        createMockNearbyBeach({
          id: 'beach-123',
          slug: undefined, // No slug, so getBeachUrlSafe will return null
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/beach/beach-123');
    });

    it('generates unique keys for each beach card', () => {
      const beaches = [
        createMockNearbyBeach({ id: 'beach-1', name: 'Beach 1' }),
        createMockNearbyBeach({ id: 'beach-2', name: 'Beach 2' }),
      ];
      const { container } = render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(2);
    });
  });

  describe('Location Display', () => {
    it('displays city and state: "San Diego, CA"', () => {
      const beaches = [
        createMockNearbyBeach({
          city: 'San Diego',
          state: 'CA',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('San Diego, CA')).toBeInTheDocument();
    });

    it('handles missing city (shows just state)', () => {
      const beaches = [
        createMockNearbyBeach({
          city: null,
          state: 'CA',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('CA')).toBeInTheDocument();
      expect(screen.queryByText(',')).not.toBeInTheDocument();
    });

    it('handles missing state (shows just city)', () => {
      const beaches = [
        createMockNearbyBeach({
          city: 'San Diego',
          state: null,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('San Diego')).toBeInTheDocument();
      expect(screen.queryByText(',')).not.toBeInTheDocument();
    });

    it('handles both city and state missing (no location paragraph)', () => {
      const beaches = [
        createMockNearbyBeach({
          city: null,
          state: null,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      // The paragraph should not be rendered if location is empty
      const paragraphs = screen.queryAllByText(/,/);
      expect(paragraphs).toHaveLength(0);
    });

    it('filters out null/undefined values correctly', () => {
      const beaches = [
        createMockNearbyBeach({
          city: undefined,
          state: 'HI',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('HI')).toBeInTheDocument();
    });
  });

  describe('Distance Display', () => {
    it('shows formatted distance text', () => {
      const beaches = [
        createMockNearbyBeach({
          distance: 3.7,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('3.7 mi')).toBeInTheDocument();
    });

    it('hides distance when undefined', () => {
      const beaches = [
        createMockNearbyBeach({
          distance: undefined,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.queryByText(/mi/)).not.toBeInTheDocument();
    });

    it('hides distance when null', () => {
      const beaches = [
        createMockNearbyBeach({
          distance: null as any,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.queryByText(/mi/)).not.toBeInTheDocument();
    });

    it('calls formatDistanceDisplay with correct parameters', () => {
      const { formatDistanceDisplay } = require('@/lib/utils/distance-utils');

      const beaches = [
        createMockNearbyBeach({
          distance: 5.2,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(formatDistanceDisplay).toHaveBeenCalledWith(5.2, 'compact');
    });

    it('displays distance as 0.0 mi when distance is 0', () => {
      const beaches = [
        createMockNearbyBeach({
          distance: 0,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('0.0 mi')).toBeInTheDocument();
    });
  });

  describe('Custom ClassName', () => {
    it('applies custom className alongside default "py-6"', () => {
      const beaches = [createMockNearbyBeach()];
      const { container } = render(
        <NearbySpotsSsr nearbyBeaches={beaches} className="custom-class" />
      );

      const section = container.querySelector('section');
      expect(section).toHaveClass('py-6 custom-class');
    });

    it('applies only default "py-6" when no className provided', () => {
      const beaches = [createMockNearbyBeach()];
      const { container } = render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const section = container.querySelector('section');
      expect(section?.className).toBe('py-6');
    });

    it('handles undefined className gracefully', () => {
      const beaches = [createMockNearbyBeach()];
      const { container } = render(
        <NearbySpotsSsr nearbyBeaches={beaches} className={undefined} />
      );

      const section = container.querySelector('section');
      expect(section?.className).toBe('py-6');
    });
  });

  describe('Grid Layout', () => {
    it('uses responsive grid classes', () => {
      const beaches = [createMockNearbyBeach()];
      const { container } = render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('gap-3');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
    });
  });

  describe('Edge Cases', () => {
    it('handles beach with very long name gracefully', () => {
      const beaches = [
        createMockNearbyBeach({
          name: 'This is an extremely long beach name that should be truncated in the UI',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(
        screen.getByText(
          'This is an extremely long beach name that should be truncated in the UI'
        )
      ).toBeInTheDocument();
    });

    it('handles beach with special characters in name', () => {
      const beaches = [
        createMockNearbyBeach({
          name: "Mākaha Beach (Surfer's Paradise)",
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText("Mākaha Beach (Surfer's Paradise)")).toBeInTheDocument();
    });

    it('handles city with special characters', () => {
      const beaches = [
        createMockNearbyBeach({
          city: "Hawai'i Kai",
          state: 'HI',
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText("Hawai'i Kai, HI")).toBeInTheDocument();
    });

    it('handles large number of beaches without error', () => {
      const beaches = Array.from({ length: 20 }, (_, i) =>
        createMockNearbyBeach({
          id: `beach-${i}`,
          name: `Beach ${i}`,
          slug: `beach-${i}`,
        })
      );
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(20);
    });

    it('handles beach with distance exactly 10 miles', () => {
      const beaches = [
        createMockNearbyBeach({
          distance: 10.0,
        }),
      ];
      render(<NearbySpotsSsr nearbyBeaches={beaches} />);

      expect(screen.getByText('10.0 mi')).toBeInTheDocument();
    });
  });
});
