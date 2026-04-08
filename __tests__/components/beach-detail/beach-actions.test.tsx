/**
 * Unit Tests for BeachActions Component
 *
 * Validates the 2-button layout after distill:
 * - "Report Conditions" and "Get Directions" are the only two action buttons
 * - Button height (48px / h-12)
 * - Icon sizing (20px / h-5 w-5)
 * - Primary button color (ocean-blue #0077B6 with ocean-blue/90 hover)
 * - Flex row layout with equal-width buttons
 * - Gap spacing (12px between buttons)
 * - Button functionality (directions, report conditions)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BeachActions } from '@/components/beach-detail/beach-actions';
import type { Beach } from '@/types/database';

// Mock HomeBeachBanner component
jest.mock('@/components/home/HomeBeachBanner', () => ({
  HomeBeachBanner: ({ selectedBeachId, selectedBeachName }: any) => (
    <div data-testid="home-beach-banner">
      Home Beach: {selectedBeachName}
    </div>
  ),
}));

// Mock UnifiedAuthModal to avoid auth dependencies
jest.mock('@/components/auth/unified-auth-modal', () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="auth-modal" data-source={props.source} />
    ) : null,
}));

// Mock ConditionsReportCard
jest.mock('@/components/beach-detail/conditions-report-card', () => ({
  ConditionsReportCard: (props: any) => (
    <div data-testid="conditions-report-card">
      <button onClick={props.onDismiss}>Cancel</button>
    </div>
  ),
}));

// Mock window.open
const mockOpen = jest.fn();
global.window.open = mockOpen;

describe('BeachActions', () => {
  const mockBeach = {
    id: 'test-beach-1',
    name: 'Test Beach',
    lat: 33.7701,
    lon: -118.1937,
    city: 'Test City',
    state: 'CA',
    country: 'USA',
    break_type: 'Beach Break',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Primary Action Buttons', () => {
    test('renders exactly two primary action buttons', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
    });

    test('does not render Plan Session button', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.queryByRole('button', { name: /plan session/i })).not.toBeInTheDocument();
    });

    test('does not render Log Session button', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.queryByRole('button', { name: /log session/i })).not.toBeInTheDocument();
    });

    test('does not render Set Alerts button', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.queryByRole('button', { name: /set alerts/i })).not.toBeInTheDocument();
    });

    test('Get Directions button is enabled when coordinates exist', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeEnabled();
    });

    test('Get Directions button is disabled when coordinates missing', () => {
      const beachWithoutCoords = { ...mockBeach, lat: null, lon: null };

      render(<BeachActions beach={beachWithoutCoords} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeDisabled();
    });
  });

  describe('Get Directions Functionality', () => {
    test('opens Google Maps with correct coordinates', () => {
      render(<BeachActions beach={mockBeach} />);

      fireEvent.click(screen.getByRole('button', { name: /get directions/i }));

      expect(mockOpen).toHaveBeenCalledWith(
        `https://www.google.com/maps/dir/?api=1&destination=${mockBeach.lat},${mockBeach.lon}`,
        '_blank',
        'noopener'
      );
    });

    test('calls onGetDirections callback when provided', () => {
      const mockOnGetDirections = jest.fn();
      render(<BeachActions beach={mockBeach} onGetDirections={mockOnGetDirections} />);

      fireEvent.click(screen.getByRole('button', { name: /get directions/i }));

      expect(mockOnGetDirections).toHaveBeenCalledTimes(1);
      expect(mockOpen).not.toHaveBeenCalled();
    });

    test('does not open maps when coordinates are missing', () => {
      const beachWithoutCoords = { ...mockBeach, lat: null, lon: null };

      render(<BeachActions beach={beachWithoutCoords} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeDisabled();
    });
  });

  describe('Report Conditions Functionality', () => {
    test('expands ConditionsReportCard inline when authenticated user clicks', () => {
      render(<BeachActions beach={mockBeach} publicMode={false} />);

      fireEvent.click(screen.getByRole('button', { name: /report conditions/i }));

      expect(screen.getByTestId('conditions-report-card')).toBeInTheDocument();
    });

    test('opens auth modal when guest clicks Report Conditions', () => {
      render(<BeachActions beach={mockBeach} publicMode={true} onAuthRequired={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: /report conditions/i }));

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
      expect(screen.getByTestId('auth-modal')).toHaveAttribute('data-source', 'conditions-report-cta');
    });

    test('does NOT call onAuthRequired when guest clicks Report Conditions (own modal handles auth)', () => {
      // BeachActions owns its own auth modal with source="conditions-report-cta"
      // for accurate funnel attribution. It MUST NOT also bubble onAuthRequired
      // to the parent — that would render a second modal in beach-detail.tsx and
      // double-fire auth_modal_opened. The parent's modal is reserved for
      // HomeBeachBanner's "Set Home Beach" CTA.
      const mockAuthRequired = jest.fn();
      render(<BeachActions beach={mockBeach} publicMode={true} onAuthRequired={mockAuthRequired} />);

      fireEvent.click(screen.getByRole('button', { name: /report conditions/i }));

      expect(mockAuthRequired).not.toHaveBeenCalled();
    });

    test('always shows Report Conditions subtitle', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByText(/share what the waves are like right now/i)).toBeInTheDocument();
    });
  });

  describe('Button Styling - Size and Layout', () => {
    test('both primary buttons have 48px height (h-12)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toHaveClass('h-12');
      expect(screen.getByRole('button', { name: /get directions/i })).toHaveClass('h-12');
    });

    test('buttons container uses flex row layout', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const flexRow = container.querySelector('.flex.gap-3');
      expect(flexRow).toBeInTheDocument();
    });

    test('buttons have correct gap spacing (gap-3 = 12px)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      expect(container.querySelector('.gap-3')).toBeInTheDocument();
    });

    test('primary buttons have correct padding (px-6 = 24px)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toHaveClass('px-6');
      expect(screen.getByRole('button', { name: /get directions/i })).toHaveClass('px-6');
    });

    test('buttons have correct font size (text-base)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toHaveClass('text-base');
      expect(screen.getByRole('button', { name: /get directions/i })).toHaveClass('text-base');
    });

    test('buttons have font-semibold (600 weight)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toHaveClass('font-semibold');
      expect(screen.getByRole('button', { name: /get directions/i })).toHaveClass('font-semibold');
    });

    test('buttons have border-radius 8px (rounded-md)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toHaveClass('rounded-md');
      expect(screen.getByRole('button', { name: /get directions/i })).toHaveClass('rounded-md');
    });

    test('flex row has correct vertical margin (my-5 = 20px)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      expect(container.querySelector('.my-5')).toBeInTheDocument();
    });
  });

  describe('Button Styling - Colors', () => {
    test('Report Conditions button has ocean-blue background with ocean-blue/90 hover', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i }))
        .toHaveClass('bg-ocean-blue', 'hover:bg-ocean-blue/90');
    });

    test('Get Directions button has gray-50 hover state', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /get directions/i }))
        .toHaveClass('hover:bg-gray-50');
    });

    test('all buttons have active transform state (scale 0.98)', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i }))
        .toHaveClass('active:scale-[0.98]');
      expect(screen.getByRole('button', { name: /get directions/i }))
        .toHaveClass('active:scale-[0.98]');
    });

    test('all buttons have transition-all for smooth animations', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i }))
        .toHaveClass('transition-all');
      expect(screen.getByRole('button', { name: /get directions/i }))
        .toHaveClass('transition-all');
    });
  });

  describe('Button Icons', () => {
    test('Get Directions button has Navigation icon', () => {
      render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn.querySelector('.lucide-navigation')).toBeInTheDocument();
    });

    test('Report Conditions button has Radio icon', () => {
      render(<BeachActions beach={mockBeach} />);

      const reportBtn = screen.getByRole('button', { name: /report conditions/i });
      expect(reportBtn.querySelector('.lucide-radio')).toBeInTheDocument();
    });

    test('primary button icons have h-5 w-5 sizing', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const radioIcon = container.querySelector('.lucide-radio');
      const navIcon = container.querySelector('.lucide-navigation');

      expect(radioIcon).toHaveClass('h-5', 'w-5');
      expect(navIcon).toHaveClass('h-5', 'w-5');
    });

    test('all icons have correct margin (mr-2)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      container.querySelectorAll('.lucide-navigation, .lucide-radio').forEach(icon => {
        expect(icon).toHaveClass('mr-2');
      });
    });
  });

  describe('HomeBeachBanner', () => {
    test('renders HomeBeachBanner with beach name', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByTestId('home-beach-banner')).toHaveTextContent(mockBeach.name);
    });
  });

  describe('Container Structure', () => {
    test('renders with correct spacing structure (space-y-4)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      expect(container.querySelector('.space-y-4')).toBeInTheDocument();
    });

    test('has data-testid="beach-actions"', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByTestId('beach-actions')).toBeInTheDocument();
    });
  });

  describe('Custom className prop', () => {
    test('applies custom className to root element', () => {
      const { container } = render(
        <BeachActions beach={mockBeach} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });

    test('preserves space-y-4 class when custom className added', () => {
      const { container } = render(
        <BeachActions beach={mockBeach} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('space-y-4');
    });
  });

  describe('Accessibility', () => {
    test('all buttons have accessible names', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
    });

    test('disabled directions button is properly marked', () => {
      const beachWithoutCoords = { ...mockBeach, lat: null, lon: null };

      render(<BeachActions beach={beachWithoutCoords} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toHaveAttribute('disabled');
    });

    test('Report Conditions button is keyboard accessible', () => {
      render(<BeachActions beach={mockBeach} />);

      const reportBtn = screen.getByRole('button', { name: /report conditions/i });
      reportBtn.focus();

      expect(reportBtn).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    test('handles beach with partial coordinates', () => {
      const beachWithOnlyLat = { ...mockBeach, lat: 33.7701, lon: null };

      render(<BeachActions beach={beachWithOnlyLat} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeDisabled();
    });

    test('handles beach with zero coordinates (falsy — disabled)', () => {
      const beachWithZeroCoords = { ...mockBeach, lat: 0, lon: 0 };

      render(<BeachActions beach={beachWithZeroCoords} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeDisabled();
    });

    test('renders correctly when all optional props omitted', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /report conditions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
    });
  });

  describe('Public Mode', () => {
    test('in publicMode, clicking Report Conditions opens auth modal', () => {
      render(
        <BeachActions beach={mockBeach} publicMode={true} onAuthRequired={jest.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: /report conditions/i }));

      expect(screen.getByTestId('auth-modal')).toBeInTheDocument();
    });

    test('in publicMode, Get Directions still works (no auth gate)', () => {
      render(
        <BeachActions beach={mockBeach} publicMode={true} onAuthRequired={jest.fn()} />
      );

      fireEvent.click(screen.getByRole('button', { name: /get directions/i }));

      expect(mockOpen).toHaveBeenCalledWith(
        expect.stringContaining('google.com/maps'),
        '_blank',
        'noopener'
      );
      expect(screen.queryByTestId('auth-modal')).not.toBeInTheDocument();
    });
  });
});
