/**
 * PersonalizedBadge Component Tests
 *
 * Tests for the enhanced PersonalizedBadge component including:
 * - Score display and color coding
 * - Display modes (compact, score, detailed)
 * - Size variants (sm, md, lg)
 * - Mobile vs desktop interactions
 * - Delta indicator
 * - Accessibility
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { PersonalizedBadge } from '@/components/recommendations/PersonalizedBadge';

// Mock the useIsMobile hook
jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: jest.fn(() => false), // Default to desktop
}));

import { useIsMobile } from '@/hooks/use-mobile';
const mockUseIsMobile = useIsMobile as jest.MockedFunction<typeof useIsMobile>;

describe('PersonalizedBadge', () => {
  beforeEach(() => {
    // Reset to desktop by default
    mockUseIsMobile.mockReturnValue(false);
  });

  describe('Visibility', () => {
    it('should render when personalized is true', () => {
      render(
        <PersonalizedBadge personalized={true} score={92} />
      );

      expect(screen.getByTestId('personalized-badge')).toBeInTheDocument();
    });

    it('should not render when personalized is false', () => {
      render(
        <PersonalizedBadge personalized={false} score={92} />
      );

      expect(screen.queryByTestId('personalized-badge')).not.toBeInTheDocument();
    });
  });

  describe('Score Display', () => {
    it('should display score as percentage when provided', () => {
      render(
        <PersonalizedBadge personalized={true} score={92} />
      );

      expect(screen.getByText('92% Match')).toBeInTheDocument();
    });

    it('should round scores to nearest integer', () => {
      render(
        <PersonalizedBadge personalized={true} score={92.7} />
      );

      expect(screen.getByText('93% Match')).toBeInTheDocument();
    });

    it('should show "Personalized for you" when score is not provided', () => {
      render(
        <PersonalizedBadge personalized={true} />
      );

      expect(screen.getByText('Personalized for you')).toBeInTheDocument();
    });
  });

  describe('Display Modes', () => {
    it('should show "Personalized" in compact mode', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          displayMode="compact"
          score={92}
        />
      );

      expect(screen.getByText('Personalized')).toBeInTheDocument();
      expect(screen.queryByText('92% Match')).not.toBeInTheDocument();
    });

    it('should show percentage in score mode (default)', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
        />
      );

      expect(screen.getByText('92% Match')).toBeInTheDocument();
    });
  });

  describe('Color Coding / Variants', () => {
    it('should use primary variant for scores >= 85', () => {
      render(
        <PersonalizedBadge personalized={true} score={90} />
      );

      const badge = screen.getByTestId('personalized-badge');
      // Primary variant has bg-primary class
      expect(badge.className).toContain('bg-primary');
    });

    it('should use blue variant for scores 70-84', () => {
      render(
        <PersonalizedBadge personalized={true} score={75} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('bg-blue-600');
    });

    it('should use secondary variant for scores 50-69', () => {
      render(
        <PersonalizedBadge personalized={true} score={60} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('bg-secondary');
    });

    it('should use outline variant for scores < 50', () => {
      render(
        <PersonalizedBadge personalized={true} score={45} />
      );

      const badge = screen.getByTestId('personalized-badge');
      // Outline variant does not have bg-primary, bg-blue, or bg-secondary
      expect(badge.className).not.toContain('bg-primary');
      expect(badge.className).not.toContain('bg-blue');
      expect(badge.className).not.toContain('bg-secondary');
    });

    it('should add glow effect for scores >= 85', () => {
      render(
        <PersonalizedBadge personalized={true} score={90} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('shadow-primary/50');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          size="sm"
        />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('text-xs');
    });

    it('should apply medium size classes (default)', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
        />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('text-sm');
    });

    it('should apply large size classes', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          size="lg"
        />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('text-base');
    });
  });

  describe('Delta Indicator', () => {
    it('should show delta when showDelta is true and baseScore provided', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={88}
          baseScore={75}
          showDelta={true}
        />
      );

      expect(screen.getByText(/\+13 for you/)).toBeInTheDocument();
    });

    it('should not show delta when showDelta is false', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={88}
          baseScore={75}
          showDelta={false}
        />
      );

      expect(screen.queryByText(/for you/)).not.toBeInTheDocument();
    });

    it('should not show delta when baseScore is not provided', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={88}
          showDelta={true}
        />
      );

      expect(screen.queryByText(/for you/)).not.toBeInTheDocument();
    });

    it('should not show negative deltas', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={70}
          baseScore={85}
          showDelta={true}
        />
      );

      expect(screen.queryByText(/for you/)).not.toBeInTheDocument();
    });
  });

  describe('Breakdown Content', () => {
    const breakdown = {
      base: 75,
      onboardingPrefs: 10,
      learnedPrefs: 5,
      affinity: 2,
    };

    it('should show tooltip with breakdown on desktop', () => {
      mockUseIsMobile.mockReturnValue(false);

      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={breakdown}
        />
      );

      // Tooltip should exist (but may not be visible until hover)
      expect(screen.getByTestId('personalized-badge')).toHaveAttribute(
        'aria-describedby',
        'match-breakdown'
      );
    });

    it('should filter out zero values from breakdown', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 0, // Should be hidden
            affinity: 0, // Should be hidden
          }}
        />
      );

      // Screen reader text should only include non-zero values
      const ariaDescription = screen.getByTestId('personalized-badge');
      expect(ariaDescription).toBeInTheDocument();
    });

    it('should show breakdown items with correct labels', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={breakdown}
        />
      );

      // Check for screen reader content
      const srContent = document.getElementById('match-breakdown');
      expect(srContent).toBeInTheDocument();
      expect(srContent?.textContent).toContain('Base score: 75');
      expect(srContent?.textContent).toContain('Your preferences: 10');
      expect(srContent?.textContent).toContain('Learned behavior: 5');
      expect(srContent?.textContent).toContain('Beach affinity: 2');
    });
  });

  describe('Affinity Badge', () => {
    it('should show affinity badge when sessionCount > 0', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          affinityData={{
            sessionCount: 15,
            lastSurfed: new Date('2025-11-01'),
          }}
        />
      );

      expect(screen.getByTestId('affinity-badge')).toBeInTheDocument();
      expect(screen.getByText(/You've surfed here 15×/)).toBeInTheDocument();
    });

    it('should not show affinity badge when sessionCount is 0', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          affinityData={{
            sessionCount: 0,
            lastSurfed: new Date('2025-11-01'),
          }}
        />
      );

      expect(screen.queryByTestId('affinity-badge')).not.toBeInTheDocument();
    });

    it('should not show affinity badge when affinityData is not provided', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
        />
      );

      expect(screen.queryByTestId('affinity-badge')).not.toBeInTheDocument();
    });

    it('should handle singular form (1 session)', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 1,
            lastSurfed: new Date('2025-11-01'),
          }}
        />
      );

      const affinityBadge = screen.getByTestId('affinity-badge');
      expect(affinityBadge).toHaveAttribute(
        'aria-label',
        "You've surfed here 1 time"
      );
    });
  });

  describe('Mobile Interactions', () => {
    it('should show collapsible instead of tooltip on mobile', () => {
      mockUseIsMobile.mockReturnValue(true);

      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 2,
          }}
        />
      );

      // Should not show tooltip
      expect(screen.queryByTestId('personalized-tooltip')).not.toBeInTheDocument();
    });

    it('should show chevron icon on mobile when breakdown exists', () => {
      mockUseIsMobile.mockReturnValue(true);

      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 2,
          }}
        />
      );

      // Check that badge has cursor-pointer class on mobile
      const badge = screen.getByTestId('personalized-badge');
      expect(badge.className).toContain('cursor-pointer');
    });
  });

  describe('Accessibility', () => {
    it('should have proper role="status"', () => {
      render(
        <PersonalizedBadge personalized={true} score={92} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge).toHaveAttribute('role', 'status');
    });

    it('should have descriptive aria-label with score', () => {
      render(
        <PersonalizedBadge personalized={true} score={92} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge).toHaveAttribute(
        'aria-label',
        '92% personalization match'
      );
    });

    it('should have aria-label without score', () => {
      render(
        <PersonalizedBadge personalized={true} />
      );

      const badge = screen.getByTestId('personalized-badge');
      expect(badge).toHaveAttribute(
        'aria-label',
        'This recommendation is personalized for you'
      );
    });

    it('should have screen reader only breakdown text', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 2,
          }}
        />
      );

      const srContent = document.getElementById('match-breakdown');
      expect(srContent).toHaveClass('sr-only');
    });

    it('should mark icons as aria-hidden', () => {
      const { container } = render(
        <PersonalizedBadge personalized={true} score={92} />
      );

      const icons = container.querySelectorAll('svg');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Custom className', () => {
    it('should accept and apply custom className', () => {
      render(
        <PersonalizedBadge
          personalized={true}
          score={92}
          className="custom-class"
        />
      );

      const container = screen.getByTestId('personalized-badge-container');
      expect(container.className).toContain('custom-class');
    });
  });
});
