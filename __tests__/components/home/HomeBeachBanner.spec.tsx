import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";

// Mock the hooks and actions
const mockSetHomeBeach = jest.fn();
const mockMutate = jest.fn();
const mockUseProfile = jest.fn();

jest.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => mockUseProfile(),
}));

// Mock profile actions - need to handle both static and dynamic imports
const mockUpdateProfile = jest.fn();
jest.mock("@/actions/profile-actions", () => ({
  updateProfile: mockUpdateProfile,
}));

// Also mock the dynamic import path
jest.doMock("@/actions/profile-actions", () => ({
  updateProfile: mockUpdateProfile,
}));

describe("HomeBeachBanner", () => {
  const selectedBeachId = "test-beach-123";

  beforeEach(() => {
    // Clear call history but keep implementation
    mockSetHomeBeach.mockClear();
    mockUpdateProfile.mockClear();
    const mockResult = {
      success: true,
      data: {
        id: "test-user-id",
        home_beach_id: selectedBeachId,
        full_name: "Test User",
      },
    };
    mockSetHomeBeach.mockResolvedValue(mockResult);
    // Ensure mockUpdateProfile returns the promise directly
    mockUpdateProfile.mockResolvedValue(mockResult);
  });

  it("renders the set home beach button when beach is not already set", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: null,
        full_name: "Test User",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate,
    });

    render(<HomeBeachBanner selectedBeachId={selectedBeachId} />);

    expect(screen.getByTestId("home-beach-banner")).toBeInTheDocument();
    expect(screen.getByTestId("set-home-beach")).toBeInTheDocument();
    expect(screen.getByText("Set Home Beach")).toBeInTheDocument();
  });

  it("does not render when beach is already set as home beach", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: selectedBeachId,
        full_name: "Test User",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate,
    });

    const { container } = render(
      <HomeBeachBanner selectedBeachId={selectedBeachId} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("calls setHomeBeach action when button is clicked", async () => {
    const user = userEvent.setup();
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: null,
        full_name: "Test User",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate,
    });

    render(<HomeBeachBanner selectedBeachId={selectedBeachId} />);

    const button = screen.getByTestId("set-home-beach");
    await act(async () => {
      await user.click(button);
    });

    await waitFor(() => {
      // Component uses dynamic import, so check mockUpdateProfile instead
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        home_beach_id: selectedBeachId,
      });
    }, { timeout: 5000 });

    // Should also trigger profile refetch
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it("shows saving state when action is in progress", async () => {
    // Make the action slow to resolve
    mockSetHomeBeach.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {
                  id: "test-user-id",
                  home_beach_id: selectedBeachId,
                  full_name: "Test User",
                },
              }),
            100
          )
        )
    );

    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: null,
        full_name: "Test User",
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate,
    });

    render(<HomeBeachBanner selectedBeachId={selectedBeachId} />);

    const button = screen.getByTestId("set-home-beach");
    fireEvent.click(button);

    // Should show saving state immediately
    expect(screen.getByText("Saving...")).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Wait for action to complete
    await waitFor(() => {
      expect(screen.getByText("Set Home Beach")).toBeInTheDocument();
    });
    expect(button).not.toBeDisabled();
  });
});
