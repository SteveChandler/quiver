/**
 * Tests for BeachActions component — Report Conditions CTA
 *
 * Validates:
 * - "Report Conditions" button is always visible
 * - "Help others know what it's really like" subtitle always visible
 * - Inline ConditionsReportCard expands on click for authenticated users
 * - Auth modal opens with correct source for guest users
 * - Auth modal uses "conditions-report-cta" source value
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BeachActions } from "@/components/beach-detail/beach-actions";

// Mock HomeBeachBanner component
jest.mock("@/components/home/HomeBeachBanner", () => ({
  HomeBeachBanner: ({ selectedBeachName }: any) => (
    <div data-testid="home-beach-banner">Home Beach: {selectedBeachName}</div>
  ),
}));

// Mock ConditionsReportCard so it doesn't need real auth/actions
jest.mock("@/components/beach-detail/conditions-report-card", () => ({
  ConditionsReportCard: (props: any) => (
    <div data-testid="conditions-report-card">
      <button onClick={props.onDismiss}>Cancel</button>
    </div>
  ),
}));

// Mock UnifiedAuthModal to capture props
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div
        data-testid="auth-modal"
        data-source={props.source}
        data-mode={props.mode}
        data-context-title={props.contextMessage?.title}
        data-context-description={props.contextMessage?.description}
      />
    ) : null,
}));

const mockBeach = {
  id: "test-beach-1",
  name: "Test Beach",
  lat: 33.7701,
  lon: -118.1937,
  city: "Test City",
  state: "CA",
  country: "USA",
  break_type: "Beach Break",
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
} as any;

describe("BeachActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Report Conditions button", () => {
    it("always shows 'Report Conditions' button regardless of auth state", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={false}
        />
      );

      expect(
        screen.getByRole("button", { name: /report conditions/i })
      ).toBeInTheDocument();
    });

    it("always shows the 'Help others know what it's really like' subtitle", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      expect(
        screen.getByText(/share what the waves are like right now/i)
      ).toBeInTheDocument();
    });

    it("expands the inline ConditionsReportCard when clicked (authenticated)", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={false}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /report conditions/i })
      );

      expect(screen.getByTestId("conditions-report-card")).toBeInTheDocument();
    });

    it("opens auth modal when guest clicks Report Conditions", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /report conditions/i })
      );

      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-source", "conditions-report-cta");
    });
  });

  describe("Source prop in public mode", () => {
    it("opens auth modal with source='conditions-report-cta' when guest clicks Report Conditions", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /report conditions/i })
      );

      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-source", "conditions-report-cta");
    });

    it("shows contextMessage title 'Report Conditions' in auth modal", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /report conditions/i })
      );

      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-context-title", "Report Conditions");
    });

    it("Get Directions does not open auth modal in publicMode", () => {
      const mockOpen = jest.fn();
      global.window.open = mockOpen;

      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /get directions/i })
      );

      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
      expect(mockOpen).toHaveBeenCalled();
    });
  });
});
