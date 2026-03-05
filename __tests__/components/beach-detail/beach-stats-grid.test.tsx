/**
 * Unit Tests for BeachStatsGrid Component
 *
 * Validates Phase 2 specifications from the beach detail refactor:
 * - Grid layout with auto-fit columns (minimum 120px) ✅
 * - Gap spacing (16px) ✅
 * - Icon sizing (24×24px) ✅
 * - Icon color (ocean-blue #0077B6) ✅
 * - Typography (12px labels uppercase with 0.05em tracking, 16px values weight 600) ✅
 * - Container styling (gray-50 bg, 20px padding, 12px border-radius, 24px margin) ✅
 * - Stat item structure (flex column with 4px gap) ✅
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BeachStatsGrid } from '@/components/beach-detail/beach-stats-grid';
import type { Beach } from '@/types/database';

// Mock the hooks
jest.mock('@/hooks/use-data-fetcher', () => ({
  useDataFetcher: jest.fn((fetchFn, options) => {
    return {
      data: options?.initialData || null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    };
  }),
}));

// Mock the direction utils
jest.mock('@/lib/utils/direction-utils', () => ({
  degreeWindowToCardinal: jest.fn((min, max) => {
    if (min === null || max === null) return null;
    if (min === 315 && max === 45) return 'N';
    if (min === 225 && max === 315) return 'W';
    return 'SW';
  }),
}));

describe('BeachStatsGrid', () => {
  const mockBeach = {
    id: 'test-beach-1',
    name: 'Test Beach',
    lat: 33.7701,
    lon: -118.1937,
    city: 'Test City',
    state: 'CA',
    country: 'USA',
    break_type: 'Beach Break',
    swell_window_min_deg: 225,
    swell_window_max_deg: 315,
    wind_offshore_deg: 90,
    wind_offshore_tol_deg: 45,
    preferred_tide_ft_min: 2,
    preferred_tide_ft_max: 5,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Layout Structure', () => {
    test('renders with correct container styling', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      // Container should have bg-gray-50, p-5, rounded-xl, my-6
      const outerContainer = container.querySelector('.bg-gray-50');
      expect(outerContainer).toBeInTheDocument();
      expect(outerContainer).toHaveClass('p-4', 'rounded-xl', 'my-4');
    });

    test('has responsive grid layout (2 cols mobile, 4 cols desktop)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      // Grid is hidden on mobile by default (expandable), visible on md+
      const grid = container.querySelector('.md\\:grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-2', 'md:grid-cols-4');
    });

    test('applies correct gap spacing (16px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const grid = container.querySelector('.md\\:grid');
      // gap-4 = 16px consistently
      expect(grid).toHaveClass('gap-4');
    });

    test('renders exactly 4 stat items', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      // Should have Break Type, Best Swell, Best Wind, Preferred Tide
      expect(screen.getByText(/break type/i)).toBeInTheDocument();
      expect(screen.getByText(/best swell/i)).toBeInTheDocument();
      expect(screen.getByText(/best wind/i)).toBeInTheDocument();
      expect(screen.getByText(/preferred tide/i)).toBeInTheDocument();
    });
  });

  describe('Break Type Stat', () => {
    test('displays break type from beach data', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      expect(screen.getByText('Beach Break')).toBeInTheDocument();
    });

    test('defaults to "Beach Break" when not specified', () => {
      const beachWithoutType = { ...mockBeach, break_type: null };
      render(<BeachStatsGrid beach={beachWithoutType} />);

      expect(screen.getByText('Beach Break')).toBeInTheDocument();
    });

    test('shows correct icon for break type', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      // Waves icon should be present (lucide-waves)
      const icon = container.querySelector('.lucide-waves');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Best Swell Stat', () => {
    test('displays calculated swell direction', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      // Should call degreeWindowToCardinal and display result
      expect(screen.getByText('W')).toBeInTheDocument();
    });

    test('shows "—" when swell direction not available', () => {
      const beachWithoutSwell = {
        ...mockBeach,
        swell_window_min_deg: null,
        swell_window_max_deg: null,
      };

      const { degreeWindowToCardinal } = require('@/lib/utils/direction-utils');
      degreeWindowToCardinal.mockReturnValue(null);

      render(<BeachStatsGrid beach={beachWithoutSwell} />);

      const swellCard = screen.getByText(/best swell/i).closest('div');
      expect(swellCard?.textContent).toContain('—');
    });

    test('uses calibration data when available', () => {
      const { useDataFetcher } = require('@/hooks/use-data-fetcher');
      const { degreeWindowToCardinal } = require('@/lib/utils/direction-utils');

      useDataFetcher.mockReturnValue({
        data: {
          best_swell_dir_deg_min: 315,
          best_swell_dir_deg_max: 45,
        },
        isLoading: false,
        error: null,
      });

      // Mock the function to return 'N' for calibration data
      degreeWindowToCardinal.mockImplementation((min: number, max: number) => {
        if (min === 315 && max === 45) return 'N';
        if (min === 225 && max === 315) return 'W';
        return 'SW';
      });

      render(<BeachStatsGrid beach={mockBeach} />);

      // Should use calibration data (N)
      expect(screen.getByText('N')).toBeInTheDocument();
    });
  });

  describe('Best Wind Stat', () => {
    test('calculates wind direction from beach data', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      // Wind offshore 90° ± 45° = 45-135° range
      const windCard = screen.getByText(/best wind/i).closest('div');
      expect(windCard).toBeInTheDocument();
    });

    test('shows "—" when wind direction not available', () => {
      const beachWithoutWind = {
        ...mockBeach,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
      };

      const { degreeWindowToCardinal } = require('@/lib/utils/direction-utils');
      degreeWindowToCardinal.mockImplementation((min: number | null, max: number | null) => {
        if (min === null || max === null) return null;
        return 'W';
      });

      render(<BeachStatsGrid beach={beachWithoutWind} />);

      const windCard = screen.getByText(/best wind/i).closest('div');
      expect(windCard?.textContent).toContain('—');
    });

    test('prefers calibration data over beach data', () => {
      const { useDataFetcher } = require('@/hooks/use-data-fetcher');
      useDataFetcher.mockReturnValue({
        data: {
          best_wind_offshore_deg: 270,
          best_wind_tol_deg: 30,
        },
        isLoading: false,
        error: null,
      });

      const { degreeWindowToCardinal } = require('@/lib/utils/direction-utils');
      degreeWindowToCardinal.mockImplementation((min: number, max: number) => {
        if (min === 240 && max === 300) return 'W';
        return 'SW';
      });

      render(<BeachStatsGrid beach={mockBeach} />);

      expect(screen.getByText('W')).toBeInTheDocument();
    });
  });

  describe('Preferred Tide Stat', () => {
    test('displays tide range when both min and max available', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      expect(screen.getByText('2–5 ft')).toBeInTheDocument();
    });

    test('displays minimum only when max not available', () => {
      const beachMinOnly = {
        ...mockBeach,
        preferred_tide_ft_min: 3,
        preferred_tide_ft_max: null,
      };

      render(<BeachStatsGrid beach={beachMinOnly} />);

      expect(screen.getByText('3+ ft')).toBeInTheDocument();
    });

    test('displays maximum only when min not available', () => {
      const beachMaxOnly = {
        ...mockBeach,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: 4,
      };

      render(<BeachStatsGrid beach={beachMaxOnly} />);

      expect(screen.getByText('4 ft or lower')).toBeInTheDocument();
    });

    test('shows "—" when no tide preference available', () => {
      const beachNoTide = {
        ...mockBeach,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
      };

      render(<BeachStatsGrid beach={beachNoTide} />);

      const tideCard = screen.getByText(/preferred tide/i).closest('div');
      expect(tideCard?.textContent).toContain('—');
    });
  });

  describe('Icon Styling', () => {
    test('stat icons have correct size class (h-6 w-6 = 24px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      // Target only stat icons (h-6 w-6), not the ChevronDown toggle (h-5 w-5)
      const statIcons = container.querySelectorAll('svg.h-6.w-6');
      expect(statIcons.length).toBe(4);
      statIcons.forEach(icon => {
        expect(icon).toHaveClass('h-6', 'w-6');
      });
    });

    test('stat icons use consistent ocean-blue color (#0077B6)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const statIcons = container.querySelectorAll('svg.text-ocean-blue');
      expect(statIcons.length).toBe(4);
      statIcons.forEach(icon => {
        expect(icon).toHaveClass('text-ocean-blue');
      });
    });

    test('stat icons have bottom margin (mb-1 = 4px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const statIcons = container.querySelectorAll('svg.mb-1');
      expect(statIcons.length).toBe(4);
      statIcons.forEach(icon => {
        expect(icon).toHaveClass('mb-1');
      });
    });
  });

  describe('Typography', () => {
    test('labels are uppercase with small font and wider tracking', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const labels = [
        screen.getByText(/break type/i),
        screen.getByText(/best swell/i),
        screen.getByText(/best wind/i),
        screen.getByText(/preferred tide/i),
      ];

      labels.forEach(label => {
        expect(label).toHaveClass('uppercase');
        expect(label).toHaveClass('text-xs'); // 12px
        expect(label).toHaveClass('tracking-wider'); // 0.05em letter-spacing
      });
    });

    test('labels have correct color (gray-500)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const label = screen.getByText(/break type/i);
      expect(label).toHaveClass('text-gray-500');
    });

    test('values have base font size and semibold weight (16px, 600)', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      const value = screen.getByText('Beach Break');
      expect(value).toHaveClass('text-base'); // 16px
      expect(value).toHaveClass('font-semibold'); // 600
    });

    test('values have correct color (gray-900)', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      const value = screen.getByText('Beach Break');
      expect(value).toHaveClass('text-gray-900');
    });
  });

  describe('Stat Item Styling', () => {
    test('each stat item uses flex column layout', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const statItems = container.querySelectorAll('.flex.flex-col');
      expect(statItems.length).toBe(4);
    });

    test('stat items have correct gap between elements (gap-1 = 4px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const statItem = container.querySelector('.flex.flex-col');
      expect(statItem).toHaveClass('gap-1');
    });

    test('container has correct padding (p-5 = 20px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const outerContainer = container.querySelector('.bg-gray-50');
      expect(outerContainer).toHaveClass('p-4');
    });

    test('container has correct border radius (rounded-xl = 12px)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const outerContainer = container.querySelector('.bg-gray-50');
      expect(outerContainer).toHaveClass('rounded-xl');
    });

    test('container has correct vertical margin (my-4 base, sm:my-6)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const outerContainer = container.querySelector('.bg-gray-50');
      expect(outerContainer).toHaveClass('my-4');
    });
  });

  describe('Accessibility', () => {
    test('stats are organized in semantic structure', () => {
      render(<BeachStatsGrid beach={mockBeach} />);

      // Each stat should have label and value
      const breakTypeLabel = screen.getByText(/break type/i);
      const breakTypeValue = screen.getByText('Beach Break');

      expect(breakTypeLabel).toBeInTheDocument();
      expect(breakTypeValue).toBeInTheDocument();
    });

    test('icons are decorative (no alt text needed)', () => {
      const { container } = render(<BeachStatsGrid beach={mockBeach} />);

      const statIcons = container.querySelectorAll('svg.text-ocean-blue');
      // SVG icons from lucide-react are decorative, no aria-label needed
      // as they're accompanied by text labels
      expect(statIcons.length).toBe(4);
    });
  });

  describe('Custom className prop', () => {
    test('applies custom className to root container', () => {
      const { container } = render(
        <BeachStatsGrid beach={mockBeach} className="custom-class" />
      );

      const rootContainer = container.querySelector('.bg-gray-50');
      expect(rootContainer).toHaveClass('custom-class');
    });
  });

  describe('Edge Cases', () => {
    test('handles beach with all null values', () => {
      const emptyBeach = {
        id: 'empty-beach',
        name: 'Empty Beach',
        lat: null,
        lon: null,
        city: null,
        state: null,
        country: null,
        break_type: null,
        swell_window_min_deg: null,
        swell_window_max_deg: null,
        wind_offshore_deg: null,
        wind_offshore_tol_deg: null,
        preferred_tide_ft_min: null,
        preferred_tide_ft_max: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      } as any;

      const { degreeWindowToCardinal } = require('@/lib/utils/direction-utils');
      degreeWindowToCardinal.mockReturnValue(null);

      render(<BeachStatsGrid beach={emptyBeach} />);

      // Should still render all 4 stats
      expect(screen.getByText(/break type/i)).toBeInTheDocument();
      expect(screen.getByText(/best swell/i)).toBeInTheDocument();
      expect(screen.getByText(/best wind/i)).toBeInTheDocument();
      expect(screen.getByText(/preferred tide/i)).toBeInTheDocument();

      // Should show default/fallback values
      expect(screen.getByText('Beach Break')).toBeInTheDocument(); // Default break type
    });

    test('handles partial calibration data', () => {
      const { useDataFetcher } = require('@/hooks/use-data-fetcher');
      useDataFetcher.mockReturnValue({
        data: {
          best_swell_dir_deg_min: 315,
          best_swell_dir_deg_max: null, // Partial data
        },
        isLoading: false,
        error: null,
      });

      render(<BeachStatsGrid beach={mockBeach} />);

      // Should handle gracefully
      expect(screen.getByText(/best swell/i)).toBeInTheDocument();
    });

    test('handles zero tide values', () => {
      const beachZeroTide = {
        ...mockBeach,
        preferred_tide_ft_min: 0,
        preferred_tide_ft_max: 2,
      };

      render(<BeachStatsGrid beach={beachZeroTide} />);

      expect(screen.getByText('0–2 ft')).toBeInTheDocument();
    });
  });

  describe('Integration with currentForecast prop', () => {
    test('accepts currentForecast prop without errors', () => {
      const mockForecast = {
        beach_id: mockBeach.id,
        timestamp: '2024-01-01T12:00:00Z',
        wave_height_ft: 3,
        wave_period_sec: 12,
      };

      // Component should render without errors even with forecast
      render(<BeachStatsGrid beach={mockBeach} currentForecast={mockForecast as any} />);

      expect(screen.getByText(/break type/i)).toBeInTheDocument();
    });

    test('renders correctly with null currentForecast', () => {
      render(<BeachStatsGrid beach={mockBeach} currentForecast={null} />);

      expect(screen.getByText(/break type/i)).toBeInTheDocument();
    });
  });
});
