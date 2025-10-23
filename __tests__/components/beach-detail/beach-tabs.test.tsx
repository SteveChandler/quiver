/**
 * Unit Tests for BeachTabs Component
 *
 * Validates Phase 5 specifications from the beach detail refactor:
 * - Tab padding (12px vertical × 24px horizontal)
 * - Font size (16px - text-base)
 * - Font weight (500 inactive, 600 active)
 * - Text colors (gray-600 inactive, ocean-blue active)
 * - Hover states (gray-50 background, gray-900 text)
 * - Active border color (ocean-blue)
 * - Transitions (0.2s ease - transition-all duration-200)
 * - Tab switching functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BeachTabs, BeachTabContent, BeachTabValue } from '@/components/beach-detail/beach-tabs';

describe('BeachTabs Component', () => {
  describe('Rendering', () => {
    test('renders all five tab triggers', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Overview content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /forecast/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /reviews/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /local intel/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /sessions/i })).toBeInTheDocument();
    });

    test('renders tab content when provided', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">
            <div>Overview Content</div>
          </BeachTabContent>
          <BeachTabContent value="forecast">
            <div>Forecast Content</div>
          </BeachTabContent>
        </BeachTabs>
      );

      // Overview should be visible by default
      expect(screen.getByText('Overview Content')).toBeInTheDocument();
    });

    test('accepts custom className prop', () => {
      const { container } = render(
        <BeachTabs className="custom-class">
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      // The Tabs root should have the custom class
      const tabsRoot = container.querySelector('.custom-class');
      expect(tabsRoot).toBeInTheDocument();
    });
  });

  describe('Default Tab Selection', () => {
    test('defaults to "overview" tab when no defaultTab provided', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Overview Content</BeachTabContent>
          <BeachTabContent value="forecast">Forecast Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('data-state', 'active');
    });

    test('respects custom defaultTab prop', () => {
      render(
        <BeachTabs defaultTab="forecast">
          <BeachTabContent value="overview">Overview Content</BeachTabContent>
          <BeachTabContent value="forecast">Forecast Content</BeachTabContent>
        </BeachTabs>
      );

      const forecastTab = screen.getByRole('tab', { name: /forecast/i });
      expect(forecastTab).toHaveAttribute('data-state', 'active');
    });

    test('supports all valid tab values as default', () => {
      const tabValues: BeachTabValue[] = ['overview', 'forecast', 'reviews', 'intel', 'sessions'];

      tabValues.forEach((tabValue) => {
        const { unmount } = render(
          <BeachTabs defaultTab={tabValue}>
            <BeachTabContent value="overview">Overview</BeachTabContent>
            <BeachTabContent value="forecast">Forecast</BeachTabContent>
            <BeachTabContent value="reviews">Reviews</BeachTabContent>
            <BeachTabContent value="intel">Intel</BeachTabContent>
            <BeachTabContent value="sessions">Sessions</BeachTabContent>
          </BeachTabs>
        );

        const tab = screen.getByRole('tab', { name: new RegExp(tabValue, 'i') });
        expect(tab).toHaveAttribute('data-state', 'active');

        unmount();
      });
    });
  });

  describe('Phase 5: Styling Specifications', () => {
    test('TabsList has correct container classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const tabsList = screen.getByRole('tablist');

      // Phase 5: Container styling
      expect(tabsList).toHaveClass('w-full');
      expect(tabsList).toHaveClass('justify-start');
      expect(tabsList).toHaveClass('border-b-2');
      expect(tabsList).toHaveClass('border-gray-200');
      expect(tabsList).toHaveClass('mb-6'); // Phase 5: 24px margin-bottom
      expect(tabsList).toHaveClass('rounded-none');
      expect(tabsList).toHaveClass('bg-transparent');
      expect(tabsList).toHaveClass('p-0');
      expect(tabsList).toHaveClass('h-auto');
    });

    test('TabTriggers have correct base classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Tab trigger base styling
      expect(overviewTab).toHaveClass('rounded-none');
      expect(overviewTab).toHaveClass('border-b-2');
      expect(overviewTab).toHaveClass('border-transparent');
      expect(overviewTab).toHaveClass('-mb-0.5'); // Phase 5: -2px margin to overlap border
    });

    test('TabTriggers have correct padding classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Padding specification (24px horizontal, 12px vertical)
      expect(overviewTab).toHaveClass('px-6'); // 24px
      expect(overviewTab).toHaveClass('py-3'); // 12px
    });

    test('TabTriggers have correct typography classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Typography specification
      expect(overviewTab).toHaveClass('text-base'); // 16px font size
      expect(overviewTab).toHaveClass('font-medium'); // 500 weight for inactive
      expect(overviewTab).toHaveClass('text-gray-600'); // Inactive text color
    });

    test('TabTriggers have correct transition classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Transition specification (0.2s ease)
      expect(overviewTab).toHaveClass('transition-all');
      expect(overviewTab).toHaveClass('duration-200');
    });

    test('TabTriggers have correct hover state classes', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Hover state specification
      expect(overviewTab).toHaveClass('hover:bg-gray-50'); // Background on hover
      expect(overviewTab).toHaveClass('hover:text-gray-900'); // Text color on hover
    });

    test('Active TabTrigger has correct active state classes', () => {
      render(
        <BeachTabs defaultTab="overview">
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      const overviewTab = screen.getByRole('tab', { name: /overview/i });

      // Phase 5: Active state specification
      expect(overviewTab).toHaveClass('data-[state=active]:border-ocean-blue'); // Border color
      expect(overviewTab).toHaveClass('data-[state=active]:text-ocean-blue'); // Text color
      expect(overviewTab).toHaveClass('data-[state=active]:font-semibold'); // Font weight 600
      expect(overviewTab).toHaveClass('data-[state=active]:bg-transparent'); // No background
      expect(overviewTab).toHaveClass('data-[state=active]:shadow-none'); // No shadow

      // Verify it actually has active state
      expect(overviewTab).toHaveAttribute('data-state', 'active');
    });

    test('Inactive TabTrigger does not have active state', () => {
      render(
        <BeachTabs defaultTab="overview">
          <BeachTabContent value="overview">Overview</BeachTabContent>
          <BeachTabContent value="forecast">Forecast</BeachTabContent>
        </BeachTabs>
      );

      const forecastTab = screen.getByRole('tab', { name: /forecast/i });

      // Should not be active
      expect(forecastTab).toHaveAttribute('data-state', 'inactive');
    });
  });

  describe('Tab Labels', () => {
    test('displays correct label for Overview tab', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    });

    test('displays correct label for Forecast tab', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="forecast">Content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: 'Forecast' })).toBeInTheDocument();
    });

    test('displays correct label for Reviews tab', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="reviews">Content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: 'Reviews' })).toBeInTheDocument();
    });

    test('displays correct label for Local Intel tab', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="intel">Content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: 'Local Intel' })).toBeInTheDocument();
    });

    test('displays correct label for Sessions tab', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="sessions">Content</BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tab', { name: 'Sessions' })).toBeInTheDocument();
    });
  });

  describe('TypeScript Type Exports', () => {
    test('BeachTabValue type includes all valid values', () => {
      // This is a compile-time test, but we can verify the values work at runtime
      const validValues: BeachTabValue[] = ['overview', 'forecast', 'reviews', 'intel', 'sessions'];

      validValues.forEach((value) => {
        const { unmount } = render(
          <BeachTabs defaultTab={value}>
            <BeachTabContent value={value}>Content</BeachTabContent>
          </BeachTabs>
        );
        unmount();
      });

      // If this doesn't throw TypeScript errors, the type is correct
      expect(true).toBe(true);
    });
  });

  describe('Content Visibility', () => {
    test('shows only the active tab content', () => {
      render(
        <BeachTabs defaultTab="overview">
          <BeachTabContent value="overview">
            <div>Overview Content Visible</div>
          </BeachTabContent>
          <BeachTabContent value="forecast">
            <div>Forecast Content Hidden</div>
          </BeachTabContent>
        </BeachTabs>
      );

      // Overview content should be visible
      expect(screen.getByText('Overview Content Visible')).toBeInTheDocument();

      // Forecast content should not be in the document (not just hidden)
      expect(screen.queryByText('Forecast Content Hidden')).not.toBeInTheDocument();
    });

    test('multiple tab contents can be defined', () => {
      render(
        <BeachTabs defaultTab="intel">
          <BeachTabContent value="overview">
            <div data-testid="overview-content">Overview Content Text</div>
          </BeachTabContent>
          <BeachTabContent value="forecast">
            <div data-testid="forecast-content">Forecast Content Text</div>
          </BeachTabContent>
          <BeachTabContent value="reviews">
            <div data-testid="reviews-content">Reviews Content Text</div>
          </BeachTabContent>
          <BeachTabContent value="intel">
            <div data-testid="intel-content">Intel Content</div>
          </BeachTabContent>
          <BeachTabContent value="sessions">
            <div data-testid="sessions-content">Sessions Content Text</div>
          </BeachTabContent>
        </BeachTabs>
      );

      // Only intel content should be visible (using testids to avoid confusion with tab labels)
      expect(screen.getByTestId('intel-content')).toBeInTheDocument();
      expect(screen.queryByTestId('overview-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('forecast-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('reviews-content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sessions-content')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('tabs have proper ARIA roles', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">Content</BeachTabContent>
        </BeachTabs>
      );

      // Should have tablist
      expect(screen.getByRole('tablist')).toBeInTheDocument();

      // Should have tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(5);
    });

    test('active tab has correct aria-selected attribute', () => {
      render(
        <BeachTabs defaultTab="forecast">
          <BeachTabContent value="forecast">Content</BeachTabContent>
        </BeachTabs>
      );

      const forecastTab = screen.getByRole('tab', { name: /forecast/i });
      expect(forecastTab).toHaveAttribute('aria-selected', 'true');

      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'false');
    });

    test('tab content has tabpanel role', () => {
      render(
        <BeachTabs defaultTab="overview">
          <BeachTabContent value="overview">
            <div>Overview Content</div>
          </BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    });
  });

  describe('Component Integration', () => {
    test('renders complex content within tabs', () => {
      render(
        <BeachTabs defaultTab="overview">
          <BeachTabContent value="overview">
            <div data-testid="complex-content">
              <h2>Beach Overview</h2>
              <p>Description text</p>
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByTestId('complex-content')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /beach overview/i })).toBeInTheDocument();
    });

    test('BeachTabContent export works correctly', () => {
      render(
        <BeachTabs>
          <BeachTabContent value="overview">
            <div>Test Content</div>
          </BeachTabContent>
        </BeachTabs>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });
});
