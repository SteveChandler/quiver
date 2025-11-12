/**
 * Tests for LearnedPreferencesDisplay component
 *
 * Validates:
 * - Display of learned preferences (wave height, period, wind, tides)
 * - Confidence indicators with proper colors
 * - Sample size display
 * - Handling of null/missing data
 * - Responsive layout
 * - Accessibility (ARIA labels, tooltips)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import '@testing-library/jest-dom';
import type { UserSurfPreferences } from '@/lib/services/preference-learning-service';
import { LearnedPreferencesDisplay } from '@/components/profile/learned-preferences-display';

// Mock UI components
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => (
    <span className={className} data-testid="badge">
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

describe('LearnedPreferencesDisplay', () => {
  const mockPreferences: UserSurfPreferences = {
    wave_min_ft: 2.5,
    wave_max_ft: 5.0,
    wave_period_min_s: 8,
    wave_period_max_s: 14,
    max_wind_mph: 15,
    preferred_wind_directions: [0, 45, 90], // N, NE, E
    preferred_tide_statuses: ['rising', 'high'],
    confidence: 0.85,
    sample_size: 20,
  };

  describe('Wave Height Display', () => {
    it('should display wave height range', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText(/Wave Height/i)).toBeInTheDocument();
      // Find the wave height section and check its content
      const waveHeightHeading = screen.getByText(/Wave Height/i);
      const waveHeightSection = waveHeightHeading.closest('div');
      const sectionText = waveHeightSection?.textContent || '';
      
      // Check that the range is displayed (format: "2.5 - 5 ft" or similar)
      expect(sectionText).toMatch(/2\.5/);
      expect(sectionText).toMatch(/5/);
      expect(sectionText).toMatch(/ft/);
    });

    it('should handle null wave height range', () => {
      const prefs = {
        ...mockPreferences,
        wave_min_ft: null,
        wave_max_ft: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Wave Height/i)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });

    it('should handle partial wave height data', () => {
      const prefs = {
        ...mockPreferences,
        wave_min_ft: 2.5,
        wave_max_ft: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });
  });

  describe('Wave Period Display', () => {
    it('should display wave period range', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText(/Wave Period/i)).toBeInTheDocument();
      expect(screen.getByText(/8.*14.*seconds/i)).toBeInTheDocument();
    });

    it('should handle null wave period', () => {
      const prefs = {
        ...mockPreferences,
        wave_period_min_s: null,
        wave_period_max_s: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Wave Period/i)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });
  });

  describe('Wind Tolerance Display', () => {
    it('should display max wind speed', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText(/Wind Tolerance/i)).toBeInTheDocument();
      expect(screen.getByText(/15.*mph/i)).toBeInTheDocument();
    });

    it('should handle null wind speed', () => {
      const prefs = {
        ...mockPreferences,
        max_wind_mph: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Wind Tolerance/i)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });
  });

  describe('Wind Direction Display', () => {
    it('should display wind directions as badges', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText(/Preferred Wind Directions/i)).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument(); // 0°
      expect(screen.getByText('NE')).toBeInTheDocument(); // 45°
      expect(screen.getByText('E')).toBeInTheDocument(); // 90°
    });

    it('should convert degrees to cardinal directions', () => {
      const prefs = {
        ...mockPreferences,
        preferred_wind_directions: [180, 270], // S, W
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('W')).toBeInTheDocument();
    });

    it('should handle null wind directions', () => {
      const prefs = {
        ...mockPreferences,
        preferred_wind_directions: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Preferred Wind Directions/i)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });

    it('should handle empty wind directions array', () => {
      const prefs = {
        ...mockPreferences,
        preferred_wind_directions: [],
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });
  });

  describe('Tide Preferences Display', () => {
    it('should display tide preferences as badges', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText(/Preferred Tides/i)).toBeInTheDocument();
      // Use getAllByText since "high" appears in both tide badges and confidence text
      const risingElements = screen.getAllByText(/rising/i);
      expect(risingElements.length).toBeGreaterThan(0);
      const highElements = screen.getAllByText(/high/i);
      expect(highElements.length).toBeGreaterThan(0);
    });

    it('should capitalize tide statuses', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByText('Rising')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should handle null tide preferences', () => {
      const prefs = {
        ...mockPreferences,
        preferred_tide_statuses: null,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Preferred Tides/i)).toBeInTheDocument();
      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });

    it('should handle empty tide preferences array', () => {
      const prefs = {
        ...mockPreferences,
        preferred_tide_statuses: [],
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
    });
  });

  describe('Confidence Indicator', () => {
    it('should display high confidence with green indicator', () => {
      const prefs = {
        ...mockPreferences,
        confidence: 0.85, // >75%
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/85%/i)).toBeInTheDocument();
      // Check for green color class or indicator
      const indicator = screen.getByTestId('confidence-indicator');
      expect(indicator).toHaveClass('bg-green-500');
    });

    it('should display medium confidence with yellow indicator', () => {
      const prefs = {
        ...mockPreferences,
        confidence: 0.65, // 50-75%
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/65%/i)).toBeInTheDocument();
      const indicator = screen.getByTestId('confidence-indicator');
      expect(indicator).toHaveClass('bg-yellow-500');
    });

    it('should display low confidence with red indicator', () => {
      const prefs = {
        ...mockPreferences,
        confidence: 0.40, // <50%
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/40%/i)).toBeInTheDocument();
      const indicator = screen.getByTestId('confidence-indicator');
      expect(indicator).toHaveClass('bg-red-500');
    });

    it('should show confidence explanation in tooltip', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      const tooltipContent = screen.getByTestId('tooltip-content');
      expect(tooltipContent).toHaveTextContent(/confidence/i);
      expect(tooltipContent).toHaveTextContent(/sessions/i);
    });
  });

  describe('Sample Size Display', () => {
    it('should display sample size', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      // Use getAllByText since "Based on X sessions" appears in both badge and confidence text
      const elements = screen.getAllByText(/Based on 20 sessions/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should use singular "session" for sample size of 1', () => {
      const prefs = {
        ...mockPreferences,
        sample_size: 1,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      // Use getAllByText since "Based on 1 session" appears in both badge and confidence text
      const elements = screen.getAllByText(/Based on 1 session/i);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should use plural "sessions" for sample size > 1', () => {
      const prefs = {
        ...mockPreferences,
        sample_size: 15,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      // Use getAllByText since "Based on X sessions" appears in both badge and confidence text
      const elements = screen.getAllByText(/Based on 15 sessions/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for all sections', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      expect(screen.getByRole('heading', { name: /Wave Height/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Wave Period/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Wind Tolerance/i })).toBeInTheDocument();
    });

    it('should have aria-label for confidence indicator', () => {
      render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      const indicator = screen.getByTestId('confidence-indicator');
      expect(indicator).toHaveAttribute('aria-label');
      expect(indicator.getAttribute('aria-label')).toContain('confidence');
    });
  });

  describe('Responsive Layout', () => {
    it('should render in grid layout', () => {
      const { container } = render(<LearnedPreferencesDisplay preferences={mockPreferences} />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveClass('grid-cols-1'); // Mobile first
      expect(grid).toHaveClass('md:grid-cols-2'); // Desktop
    });
  });

  describe('Edge Cases', () => {
    it('should handle all null preferences gracefully', () => {
      const prefs: UserSurfPreferences = {
        wave_min_ft: null,
        wave_max_ft: null,
        wave_period_min_s: null,
        wave_period_max_s: null,
        max_wind_mph: null,
        preferred_wind_directions: null,
        preferred_tide_statuses: null,
        confidence: 0.0,
        sample_size: 0,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      // Should still render the component with "Not enough data" messages
      expect(screen.getAllByText(/Not enough data/i)).toHaveLength(5);
    });

    it('should handle zero confidence', () => {
      const prefs = {
        ...mockPreferences,
        confidence: 0.0,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/0%/i)).toBeInTheDocument();
    });

    it('should handle maximum confidence', () => {
      const prefs = {
        ...mockPreferences,
        confidence: 1.0,
      };

      render(<LearnedPreferencesDisplay preferences={prefs} />);

      expect(screen.getByText(/100%/i)).toBeInTheDocument();
    });
  });
});
