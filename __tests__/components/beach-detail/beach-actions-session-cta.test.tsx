/**
 * TDD tests for session CTA improvements in BeachActions (Task 8A)
 *
 * Validates:
 * - "Track Your Sessions" label for guest users on the Log Session button
 * - "Plan a Session" label for guest users on the Plan Session button
 * - Supporting description text visible below each button in public mode
 * - Correct source values passed to UnifiedAuthModal per button
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BeachActions } from "@/components/beach-detail/beach-actions";

// Mock FavoriteButton component
jest.mock("@/components/favorite-button", () => ({
  FavoriteButton: ({ beachId }: { beachId: string }) => (
    <button data-testid="favorite-button">Favorite {beachId}</button>
  ),
}));

// Mock HomeBeachBanner component
jest.mock("@/components/home/HomeBeachBanner", () => ({
  HomeBeachBanner: ({ selectedBeachName }: any) => (
    <div data-testid="home-beach-banner">Home Beach: {selectedBeachName}</div>
  ),
}));

// Mock BeachAlertCta to avoid auth dependencies
jest.mock("@/components/beach-detail/beach-alert-cta", () => ({
  BeachAlertCta: ({ beachName }: any) => (
    <div data-testid="beach-alert-cta">{beachName}</div>
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

describe("BeachActions - session CTA improvements for guests (Task 8A)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Guest button labels", () => {
    it("shows 'Track Your Sessions' label for guest users on Log Session button", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /track your sessions/i })
      ).toBeInTheDocument();
    });

    it("shows 'Plan a Session' label for guest users on Plan Session button", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /plan a session/i })
      ).toBeInTheDocument();
    });

    it("shows 'Log Session' label for authenticated users (no publicMode)", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={false}
          onLogSession={jest.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /log session/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /track your sessions/i })
      ).not.toBeInTheDocument();
    });

    it("shows 'Plan Session' label for authenticated users (no publicMode)", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={false}
          onPlanSession={jest.fn()}
        />
      );

      expect(
        screen.getByRole("button", { name: /plan session/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /plan a session/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Guest description text", () => {
    it("shows description text for guest session buttons", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      expect(
        screen.getByText(/build your surf log and unlock personalized recommendations/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/coordinate with friends and pick the best time/i)
      ).toBeInTheDocument();
    });

    it("does not show description text for authenticated users", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={false}
        />
      );

      expect(
        screen.queryByText(/build your surf log/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/coordinate with friends/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Source prop per button", () => {
    it("opens auth modal with source='session-log-cta' when guest clicks Track Your Sessions", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /track your sessions/i })
      );

      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-source", "session-log-cta");
    });

    it("opens auth modal with source='session-plan-cta' when guest clicks Plan a Session", () => {
      render(
        <BeachActions
          beach={mockBeach}
          publicMode={true}
          onAuthRequired={jest.fn()}
        />
      );

      fireEvent.click(
        screen.getByRole("button", { name: /plan a session/i })
      );

      const modal = screen.getByTestId("auth-modal");
      expect(modal).toHaveAttribute("data-source", "session-plan-cta");
    });
  });
});
