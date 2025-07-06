import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionForm } from "@/components/session-forms/SessionForm";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import {
  mockGearSuggestionsResponse,
  mockOptimalTimesResponse,
  mockFriends,
  mockAuthContext,
  createMockDataFetcherResponse,
  setupMockFetch,
} from "../../setup/session-planner-test-utils";

// Mock all the dependencies
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/context/auth-context");
jest.mock("next/navigation");
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock server actions
jest.mock("@/actions/session-actions", () => ({
  createPlannedSession: jest.fn().mockResolvedValue({
    success: true,
    data: { id: "session-123" },
  }),
  createLoggedSession: jest.fn().mockResolvedValue({
    id: "session-123",
  }),
  getPlannedSessionForConversion: jest.fn(),
  updatePlannedSessionToCompleted: jest.fn(),
}));

jest.mock("@/actions/session-media-actions", () => ({
  uploadSessionPhotosAction: jest.fn(),
}));

jest.mock("@/actions/social-actions", () => ({
  getUserFollowing: jest.fn().mockResolvedValue({
    success: true,
    data: mockFriends.map((friend) => ({ following: friend })),
  }),
}));

const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;

// Setup mock fetch
setupMockFetch();

describe("SessionForm - Planner Integration", () => {
  const mockPush = jest.fn();
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup router mocks
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseSearchParams.mockReturnValue({
      get: mockGet,
      has: jest.fn(),
      getAll: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
      forEach: jest.fn(),
      toString: jest.fn(),
    } as any);

    // Setup auth mock
    mockUseAuth.mockReturnValue(mockAuthContext);

    // Setup default beach data for location step
    const mockBeaches = [
      { id: "beach-1", name: "Ocean Beach" },
      { id: "beach-2", name: "Pacific Beach" },
    ];

    // Setup useDataFetcher responses for different API calls
    mockUseDataFetcher.mockImplementation((fetchFn, options) => {
      // Convert function to string to identify which API call it is
      const fnString = fetchFn.toString();

      if (fnString.includes("gear-suggestions")) {
        return createMockDataFetcherResponse(
          mockGearSuggestionsResponse,
          false
        );
      } else if (fnString.includes("optimal-times")) {
        return createMockDataFetcherResponse(mockOptimalTimesResponse, false);
      } else if (fnString.includes("invitations?type=friends")) {
        return createMockDataFetcherResponse(mockFriends, false);
      } else {
        // Default to beaches data
        return createMockDataFetcherResponse(mockBeaches, false);
      }
    });
  });

  describe("Planning mode with new features", () => {
    beforeEach(() => {
      mockGet.mockReturnValue(null); // No convertSessionId
    });

    it("should render all planner sections in planning mode", async () => {
      render(<SessionForm mode="plan" />);

      // Wait for the form to load
      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Location section should be present
      expect(screen.getByText("Where will you surf?")).toBeInTheDocument();

      // Date/Time section should be present
      expect(screen.getByText("When will you surf?")).toBeInTheDocument();

      // Equipment section should be present
      expect(screen.getByText("Which board will you use?")).toBeInTheDocument();

      // Goals section should be present
      expect(screen.getByText("What are your goals?")).toBeInTheDocument();

      // Notes section should be present
      expect(screen.getByText("Notes & Invite Friends")).toBeInTheDocument();
    });

    it("should show planner features after selecting beach and date", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Fill in beach selection
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");

      // Select the beach
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      // Fill in date
      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Wait for planner features to load
      await waitFor(() => {
        expect(
          screen.getByText("Optimal Times for 2024-01-17")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Smart Board Recommendations")
        ).toBeInTheDocument();
      });
    });

    it("should allow selecting optimal time and update gear suggestions", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Set up beach and date first
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Wait for optimal times to load
      await waitFor(() => {
        expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      });

      // Select optimal time
      const timeButton = screen.getByRole("button", { name: /6:00 AM/ });
      await user.click(timeButton);

      // Verify that gear suggestions show updated conditions
      await waitFor(() => {
        expect(screen.getByText(/4.5ft waves • 5mph wind/)).toBeInTheDocument();
      });
    });

    it("should allow selecting recommended board from gear suggestions", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Set up beach and date first
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Wait for gear suggestions to load
      await waitFor(() => {
        expect(screen.getByText("Daily Driver")).toBeInTheDocument();
      });

      // Select a board
      const boardButton = screen.getByRole("button", { name: /Daily Driver/ });
      await user.click(boardButton);

      // Verify board is selected (should show visual indicators)
      expect(boardButton).toHaveClass("ring-2", "ring-primary");
    });

    it("should allow inviting friends in planning mode", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Scroll down to invitations section
      const inviteSection = screen.getByText("Invite Friends (Optional)");
      expect(inviteSection).toBeInTheDocument();

      // Select a friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Verify invitation preview shows
      await waitFor(() => {
        expect(screen.getByText("Invitation Preview")).toBeInTheDocument();
        expect(screen.getByText("Who: 1 people")).toBeInTheDocument();
      });
    });

    it("should create planned session with all planner data", async () => {
      const user = userEvent.setup();
      const { createPlannedSession } = await import(
        "@/actions/session-actions"
      );

      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Fill out the form
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      const timeInput = screen.getByLabelText(/start time/i);
      await user.type(timeInput, "06:00");

      // Wait for planner features to load and select options
      await waitFor(() => {
        expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      });

      const timeButton = screen.getByRole("button", { name: /6:00 AM/ });
      await user.click(timeButton);

      await waitFor(() => {
        expect(screen.getByText("Daily Driver")).toBeInTheDocument();
      });

      const boardButton = screen.getByRole("button", { name: /Daily Driver/ });
      await user.click(boardButton);

      // Select a friend
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Submit the form
      const submitButton = screen.getByRole("button", {
        name: /plan session/i,
      });
      await user.click(submitButton);

      // Verify createPlannedSession was called with correct data
      await waitFor(() => {
        expect(createPlannedSession).toHaveBeenCalledWith(
          expect.objectContaining({
            beach_name: "Ocean Beach",
            beach_id: "beach-1",
            arrival_time: expect.stringContaining("2024-01-17"),
            board_id: "board-1",
            status: "planned",
          }),
          mockAuthContext.user.id
        );
      });
    });
  });

  describe("Logging mode without planner features", () => {
    it("should not show planner features in logging mode", async () => {
      render(<SessionForm mode="log" />);

      await waitFor(() => {
        expect(screen.getByText("Log Session")).toBeInTheDocument();
      });

      // Should not show optimal times section
      expect(screen.queryByText("Optimal Times")).not.toBeInTheDocument();

      // Should not show gear suggestions section
      expect(
        screen.queryByText("Smart Board Recommendations")
      ).not.toBeInTheDocument();

      // Should not show invitations section
      expect(screen.queryByText("Invite Friends")).not.toBeInTheDocument();
    });

    it("should show conditions and photos sections in logging mode", async () => {
      render(<SessionForm mode="log" />);

      await waitFor(() => {
        expect(screen.getByText("Log Session")).toBeInTheDocument();
      });

      // Should show conditions section
      expect(screen.getByText("Session Conditions")).toBeInTheDocument();

      // Should show photos section
      expect(screen.getByText("Session Photos")).toBeInTheDocument();
    });
  });

  describe("Integration between planner features", () => {
    it("should update gear suggestions when optimal time is selected", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Set up beach and date
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Wait for sections to load
      await waitFor(() => {
        expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      });

      // Initially shows default conditions
      expect(screen.getByText("3ft waves • 10mph wind")).toBeInTheDocument();

      // Select optimal time
      const timeButton = screen.getByRole("button", { name: /6:00 AM/ });
      await user.click(timeButton);

      // Gear suggestions should update with new conditions
      await waitFor(() => {
        expect(screen.getByText("4.5ft waves • 5mph wind")).toBeInTheDocument();
      });
    });

    it("should include optimal time data in invitation preview", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Set up form data
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Select optimal time
      await waitFor(() => {
        expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      });

      const timeButton = screen.getByRole("button", { name: /6:00 AM/ });
      await user.click(timeButton);

      // Select a friend to show invitation preview
      const johnButton = screen.getByRole("button", { name: /John Surfer/ });
      await user.click(johnButton);

      // Invitation preview should show updated time
      await waitFor(() => {
        expect(
          screen.getByText(/When: 2024-01-17 at 06:00:00/)
        ).toBeInTheDocument();
      });
    });

    it("should handle loading states gracefully", async () => {
      // Mock loading state for one of the features
      mockUseDataFetcher.mockImplementation((fetchFn, options) => {
        const fnString = fetchFn.toString();

        if (fnString.includes("optimal-times")) {
          return createMockDataFetcherResponse(null, true); // Loading
        } else if (fnString.includes("gear-suggestions")) {
          return createMockDataFetcherResponse(
            mockGearSuggestionsResponse,
            false
          );
        } else {
          return createMockDataFetcherResponse(mockFriends, false);
        }
      });

      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Should show loading state for optimal times
      expect(screen.getByText("Finding Optimal Times...")).toBeInTheDocument();

      // But other sections should still work
      expect(
        screen.getByText("Smart Board Recommendations")
      ).toBeInTheDocument();
    });

    it("should handle errors in one feature without breaking others", async () => {
      // Mock error state for gear suggestions
      mockUseDataFetcher.mockImplementation((fetchFn, options) => {
        const fnString = fetchFn.toString();

        if (fnString.includes("gear-suggestions")) {
          return createMockDataFetcherResponse(
            null,
            false,
            new Error("API Error")
          );
        } else if (fnString.includes("optimal-times")) {
          return createMockDataFetcherResponse(mockOptimalTimesResponse, false);
        } else {
          return createMockDataFetcherResponse(mockFriends, false);
        }
      });

      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Should show error for gear suggestions
      expect(
        screen.getByText("Unable to Load Gear Suggestions")
      ).toBeInTheDocument();

      // But optimal times should still work
      expect(
        screen.getByText("Optimal Times for 2024-01-17")
      ).toBeInTheDocument();

      // And invitations should still work
      expect(screen.getByText("Invite Friends (Optional)")).toBeInTheDocument();
    });
  });

  describe("Form validation with planner features", () => {
    it("should require basic fields regardless of planner feature selection", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Try to submit without required fields
      const submitButton = screen.getByRole("button", {
        name: /plan session/i,
      });
      await user.click(submitButton);

      // Should not submit (form should prevent submission)
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("should allow submission with minimal required data", async () => {
      const user = userEvent.setup();
      render(<SessionForm mode="plan" />);

      await waitFor(() => {
        expect(screen.getByText("Plan Session")).toBeInTheDocument();
      });

      // Fill only required fields
      const beachInput = screen.getByPlaceholderText(/search for a beach/i);
      await user.type(beachInput, "Ocean Beach");
      const beachOption = await screen.findByText("Ocean Beach");
      await user.click(beachOption);

      const dateInput = screen.getByLabelText(/session date/i);
      await user.type(dateInput, "2024-01-17");

      // Submit
      const submitButton = screen.getByRole("button", {
        name: /plan session/i,
      });
      await user.click(submitButton);

      // Should submit successfully
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/profile");
      });
    });
  });
});
