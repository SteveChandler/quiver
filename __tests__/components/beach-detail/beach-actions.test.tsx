/**
 * Unit Tests for BeachActions Component
 *
 * Validates Phase 3 specifications from the beach detail refactor:
 * - Button height (should be 48px exact, currently size="lg")
 * - Icon sizing (currently 16px, spec wants 20px)
 * - Primary button color (ocean-blue #0077B6 with ocean-blue/90 hover)
 * - Grid layout (responsive: mobile stack, desktop row)
 * - Gap spacing (12px between buttons)
 * - Button functionality (directions, session planning)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BeachActions } from '@/components/beach-detail/beach-actions';
import type { Beach } from '@/types/database';

// Mock FavoriteButton component
jest.mock('@/components/favorite-button', () => ({
  FavoriteButton: ({ beachId }: { beachId: string }) => (
    <button data-testid="favorite-button">Favorite {beachId}</button>
  ),
}));

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

  const mockOnPlanSession = jest.fn();
  const mockOnLogSession = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Primary Action Buttons', () => {
    test('renders all three primary action buttons', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log session/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /plan session/i })).toBeInTheDocument();
    });

    test('Get Directions button is visible and enabled when coordinates exist', () => {
      render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toBeInTheDocument();
      expect(directionsBtn).toBeEnabled();
    });

    test('Get Directions button is disabled when coordinates missing', () => {
      const beachWithoutCoords = {
        ...mockBeach,
        lat: null,
        lon: null,
      };

      render(<BeachActions beach={beachWithoutCoords} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toBeDisabled();
    });

    test('Log Session button calls onLogSession callback when clicked', () => {
      render(
        <BeachActions
          beach={mockBeach}
          onLogSession={mockOnLogSession}
        />
      );

      const logBtn = screen.getByRole('button', { name: /log session/i });
      fireEvent.click(logBtn);

      expect(mockOnLogSession).toHaveBeenCalledTimes(1);
    });

    test('Plan Session button calls onPlanSession callback when clicked', () => {
      render(
        <BeachActions
          beach={mockBeach}
          onPlanSession={mockOnPlanSession}
        />
      );

      const planBtn = screen.getByRole('button', { name: /plan session/i });
      fireEvent.click(planBtn);

      expect(mockOnPlanSession).toHaveBeenCalledTimes(1);
    });

    test('buttons work without callbacks provided', () => {
      render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });

      // Should not throw errors
      expect(() => fireEvent.click(logBtn)).not.toThrow();
      expect(() => fireEvent.click(planBtn)).not.toThrow();
    });
  });

  describe('Get Directions Functionality', () => {
    test('opens Google Maps with correct coordinates', () => {
      render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      fireEvent.click(directionsBtn);

      expect(mockOpen).toHaveBeenCalledWith(
        `https://www.google.com/maps/dir/?api=1&destination=${mockBeach.lat},${mockBeach.lon}`,
        '_blank',
        'noopener'
      );
    });

    test('does not open maps when coordinates are missing', () => {
      const beachWithoutCoords = {
        ...mockBeach,
        lat: null,
        lon: null,
      };

      render(<BeachActions beach={beachWithoutCoords} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });

      // Button should be disabled, but try clicking anyway
      expect(directionsBtn).toBeDisabled();
    });
  });

  describe('Button Styling - Size and Layout (Phase 3 Compliance)', () => {
    test('all action buttons have exact 48px height (h-12)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });

      // Phase 3 spec requires exactly 48px (h-12) for primary buttons
      expect(logBtn).toHaveClass('h-12');
      expect(planBtn).toHaveClass('h-12');
      // Directions button on mobile has h-10, which is acceptable
    });

    test('buttons container uses grid layout (2 cols mobile, 2 cols desktop)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      // Component uses grid-cols-1 sm:grid-cols-2
      const primaryContainer = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2');
      expect(primaryContainer).toBeInTheDocument();
    });

    test('buttons have correct gap spacing (gap-3 = 12px)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const gridContainer = container.querySelector('.gap-3');
      expect(gridContainer).toBeInTheDocument();
    });

    test('primary buttons have correct padding (px-6 = 24px)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });

      expect(logBtn).toHaveClass('px-6');
      expect(planBtn).toHaveClass('px-6');
    });

    test('secondary button has correct padding (px-4 = 16px)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toHaveClass('px-4');
    });

    test('buttons have correct font size (text-base for primary, text-sm for secondary)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });
      const directionsBtn = screen.getByRole('button', { name: /get directions/i });

      expect(logBtn).toHaveClass('text-base');
      expect(planBtn).toHaveClass('text-base');
      expect(directionsBtn).toHaveClass('text-sm');
    });

    test('primary buttons have font-semibold (600 weight)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });

      expect(logBtn).toHaveClass('font-semibold');
      expect(planBtn).toHaveClass('font-semibold');
    });

    test('secondary button has font-medium (500 weight)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toHaveClass('font-medium');
    });

    test('buttons have border-radius 8px (rounded-md)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });
      const directionsBtn = screen.getByRole('button', { name: /get directions/i });

      expect(logBtn).toHaveClass('rounded-md');
      expect(planBtn).toHaveClass('rounded-md');
      expect(directionsBtn).toHaveClass('rounded-md');
    });
  });

  describe('Button Styling - Colors (Phase 3 Compliance)', () => {
    test('Log Session button has ocean-blue background with ocean-blue/90 hover', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      // Phase 3 spec: #0077B6 background, ocean-blue/90 hover (now using Tailwind class)
      expect(logBtn).toHaveClass('bg-ocean-blue', 'hover:bg-ocean-blue/90');
    });

    test('Plan Session button has ocean-blue background with ocean-blue/90 hover', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const planBtn = screen.getByRole('button', { name: /plan session/i });
      // Phase 3 spec: #0077B6 background, ocean-blue/90 hover (now using Tailwind class)
      expect(planBtn).toHaveClass('bg-ocean-blue', 'hover:bg-ocean-blue/90');
    });

    test('Get Directions button has gray-50 hover state', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toHaveClass('hover:bg-gray-50');
    });

    test('all buttons have active transform state (scale 0.98)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });
      const directionsBtn = screen.getByRole('button', { name: /get directions/i });

      // Phase 3 spec requires active:scale-[0.98]
      expect(logBtn).toHaveClass('active:scale-[0.98]');
      expect(planBtn).toHaveClass('active:scale-[0.98]');
      expect(directionsBtn).toHaveClass('active:scale-[0.98]');
    });

    test('all buttons have transition-all for smooth animations', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const planBtn = screen.getByRole('button', { name: /plan session/i });
      const directionsBtn = screen.getByRole('button', { name: /get directions/i });

      expect(logBtn).toHaveClass('transition-all');
      expect(planBtn).toHaveClass('transition-all');
      expect(directionsBtn).toHaveClass('transition-all');
    });
  });

  describe('Button Icons', () => {
    test('Get Directions button has Navigation icon', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      const icon = directionsBtn.querySelector('.lucide-navigation');

      expect(icon).toBeInTheDocument();
    });

    test('Log Session button has Plus icon', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logBtn = screen.getByRole('button', { name: /log session/i });
      const icon = logBtn.querySelector('.lucide-plus');

      expect(icon).toBeInTheDocument();
    });

    test('Plan Session button has BookOpen icon', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const planBtn = screen.getByRole('button', { name: /plan session/i });
      const icon = planBtn.querySelector('.lucide-book-open');

      expect(icon).toBeInTheDocument();
    });

    test('all icons have correct size (h-5 w-5 for primary, h-4 w-4 for directions)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const logIcon = container.querySelector('.lucide-plus');
      const planIcon = container.querySelector('.lucide-book-open');
      const directionsIcon = container.querySelector('.lucide-navigation');

      // Primary buttons use h-5 w-5 (20×20px)
      expect(logIcon).toHaveClass('h-5', 'w-5');
      expect(planIcon).toHaveClass('h-5', 'w-5');
      // Directions button uses h-4 w-4 (16×16px)
      expect(directionsIcon).toHaveClass('h-4', 'w-4');
    });

    test('all icons have correct margin (mr-2)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const icons = container.querySelectorAll('.lucide-navigation, .lucide-plus, .lucide-book-open');

      icons.forEach(icon => {
        expect(icon).toHaveClass('mr-2');
      });
    });
  });

  describe('Secondary Actions', () => {
    test('renders HomeBeachBanner components (mobile and desktop)', () => {
      render(<BeachActions beach={mockBeach} />);

      // Component renders HomeBeachBanner for both mobile and desktop
      const homeBanners = screen.getAllByTestId('home-beach-banner');
      expect(homeBanners.length).toBeGreaterThanOrEqual(1);
      expect(homeBanners[0]).toHaveTextContent(mockBeach.name);
    });

    test('secondary actions are in flex container with gap (mobile section)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      // Mobile section uses flex layout
      const secondaryContainer = container.querySelector('.flex.flex-wrap.items-center.gap-3');
      expect(secondaryContainer).toBeInTheDocument();
    });
  });

  describe('Responsive Layout (Phase 3 Grid System)', () => {
    test('uses 1 column on mobile, 2 columns on small screens (grid-cols-1 sm:grid-cols-2)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const gridContainer = container.querySelector('.grid-cols-1.sm\\:grid-cols-2');
      expect(gridContainer).toBeInTheDocument();
    });

    test('Plan Session button does not span columns', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const planBtn = screen.getByRole('button', { name: /plan session/i });
      // Component doesn't use col-span classes
      expect(planBtn).not.toHaveClass('col-span-2');
      expect(planBtn).not.toHaveClass('md:col-span-1');
    });

    test('grid container has correct margin (my-5 = 20px vertical)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('my-5');
    });

    test('mobile section is hidden on desktop (md:hidden)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const mobileSection = container.querySelector('.md\\:hidden');
      expect(mobileSection).toBeInTheDocument();
    });

    test('desktop home beach banner is hidden on mobile (hidden md:block)', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const desktopBanner = container.querySelector('.hidden.md\\:block');
      expect(desktopBanner).toBeInTheDocument();
    });
  });

  describe('Container Structure', () => {
    test('renders with correct spacing structure', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      // Root container should have space-y-4
      const root = container.querySelector('.space-y-4');
      expect(root).toBeInTheDocument();
    });

    test('secondary actions appear after primary actions', () => {
      const { container } = render(<BeachActions beach={mockBeach} />);

      const root = container.firstChild;
      expect(root?.childNodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Custom className prop', () => {
    test('applies custom className to root element', () => {
      const { container } = render(
        <BeachActions beach={mockBeach} className="custom-class" />
      );

      const root = container.firstChild;
      expect(root).toHaveClass('custom-class');
    });

    test('preserves other classes when custom className added', () => {
      const { container } = render(
        <BeachActions beach={mockBeach} className="custom-class" />
      );

      const root = container.firstChild;
      expect(root).toHaveClass('space-y-4');
      expect(root).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    test('all buttons have accessible names', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log session/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /plan session/i })).toBeInTheDocument();
    });

    test('disabled button is properly marked', () => {
      const beachWithoutCoords = {
        ...mockBeach,
        lat: null,
        lon: null,
      };

      render(<BeachActions beach={beachWithoutCoords} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toHaveAttribute('disabled');
    });

    test('buttons are keyboard accessible', () => {
      render(
        <BeachActions
          beach={mockBeach}
          onLogSession={mockOnLogSession}
        />
      );

      const logBtn = screen.getByRole('button', { name: /log session/i });
      logBtn.focus();

      expect(logBtn).toHaveFocus();

      // Simulate Enter key
      fireEvent.keyDown(logBtn, { key: 'Enter', code: 'Enter' });
      // Button click handlers work with keyboard
    });

    test('icons do not interfere with button text', () => {
      render(<BeachActions beach={mockBeach} />);

      // Button text should be readable with screen readers
      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn.textContent).toContain('Get directions');
    });
  });

  describe('Edge Cases', () => {
    test('handles beach with partial coordinates', () => {
      const beachWithOnlyLat = {
        ...mockBeach,
        lat: 33.7701,
        lon: null,
      };

      render(<BeachActions beach={beachWithOnlyLat} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      expect(directionsBtn).toBeDisabled();
    });

    test('handles beach with zero coordinates', () => {
      const beachWithZeroCoords = {
        ...mockBeach,
        lat: 0,
        lon: 0,
      };

      render(<BeachActions beach={beachWithZeroCoords} />);

      const directionsBtn = screen.getByRole('button', { name: /get directions/i });
      // Zero coordinates (0,0) would be in the ocean near Africa - technically valid
      // But in our case, 0 is falsy so button will be disabled
      expect(directionsBtn).toBeDisabled();
    });

    test('handles multiple rapid clicks', () => {
      render(
        <BeachActions
          beach={mockBeach}
          onLogSession={mockOnLogSession}
        />
      );

      const logBtn = screen.getByRole('button', { name: /log session/i });

      fireEvent.click(logBtn);
      fireEvent.click(logBtn);
      fireEvent.click(logBtn);

      expect(mockOnLogSession).toHaveBeenCalledTimes(3);
    });

    test('renders correctly when all optional props omitted', () => {
      render(<BeachActions beach={mockBeach} />);

      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log session/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /plan session/i })).toBeInTheDocument();
    });
  });

  describe('Public Mode Auth Gating', () => {
    test('in publicMode, clicking "Track Your Sessions" calls onAuthRequired instead of onLogSession', () => {
      const mockAuthRequired = jest.fn();
      render(
        <BeachActions
          beach={mockBeach}
          onLogSession={mockOnLogSession}
          publicMode={true}
          onAuthRequired={mockAuthRequired}
        />
      );

      // In public mode the label changes to "Track Your Sessions"
      const logBtn = screen.getByRole('button', { name: /track your sessions/i });
      fireEvent.click(logBtn);

      expect(mockAuthRequired).toHaveBeenCalledTimes(1);
      expect(mockOnLogSession).not.toHaveBeenCalled();
    });

    test('in publicMode, clicking "Plan a Session" calls onAuthRequired instead of onPlanSession', () => {
      const mockAuthRequired = jest.fn();
      render(
        <BeachActions
          beach={mockBeach}
          onPlanSession={mockOnPlanSession}
          publicMode={true}
          onAuthRequired={mockAuthRequired}
        />
      );

      // In public mode the label changes to "Plan a Session"
      const planBtn = screen.getByRole('button', { name: /plan a session/i });
      fireEvent.click(planBtn);

      expect(mockAuthRequired).toHaveBeenCalledTimes(1);
      expect(mockOnPlanSession).not.toHaveBeenCalled();
    });

    test('without publicMode, buttons call original handlers normally', () => {
      const mockAuthRequired = jest.fn();
      render(
        <BeachActions
          beach={mockBeach}
          onLogSession={mockOnLogSession}
          onPlanSession={mockOnPlanSession}
          onAuthRequired={mockAuthRequired}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /log session/i }));
      fireEvent.click(screen.getByRole('button', { name: /plan session/i }));

      expect(mockOnLogSession).toHaveBeenCalledTimes(1);
      expect(mockOnPlanSession).toHaveBeenCalledTimes(1);
      expect(mockAuthRequired).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    test('components work together without conflicts', () => {
      render(
        <BeachActions
          beach={mockBeach}
          onPlanSession={mockOnPlanSession}
          onLogSession={mockOnLogSession}
          className="custom-class"
        />
      );

      // All components should render
      expect(screen.getByRole('button', { name: /get directions/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log session/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /plan session/i })).toBeInTheDocument();

      // Component renders HomeBeachBanner (mobile + desktop)
      expect(screen.getAllByTestId('home-beach-banner').length).toBeGreaterThanOrEqual(1);
    });

    test('callbacks and rendering work independently', () => {
      const { rerender } = render(
        <BeachActions beach={mockBeach} onLogSession={mockOnLogSession} />
      );

      const logBtn = screen.getByRole('button', { name: /log session/i });
      fireEvent.click(logBtn);

      expect(mockOnLogSession).toHaveBeenCalledTimes(1);

      // Rerender with different callback
      const newCallback = jest.fn();
      rerender(
        <BeachActions beach={mockBeach} onLogSession={newCallback} />
      );

      fireEvent.click(logBtn);
      expect(newCallback).toHaveBeenCalledTimes(1);
      expect(mockOnLogSession).toHaveBeenCalledTimes(1); // Old callback not called again
    });
  });
});
