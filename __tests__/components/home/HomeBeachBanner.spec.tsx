import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";

// Mock the hooks and actions
const mockSetHomeBeach = jest.fn();
const mockMutate = jest.fn();
const mockUseProfile = jest.fn();

jest.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => mockUseProfile()
}));

jest.mock("@/actions/profile-actions", () => ({
  setHomeBeach: (...args: any[]) => mockSetHomeBeach(...args),
}));

describe("HomeBeachBanner", () => {
  const selectedBeachId = "test-beach-123";

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetHomeBeach.mockResolvedValue({
      success: true,
      data: {
        id: "test-user-id",
        home_beach_id: selectedBeachId,
        full_name: "Test User"
      }
    });
  });

  it("renders the set home beach button when beach is not already set", () => {
    mockUseProfile.mockReturnValue({
      profile: { 
        id: "test-user-id", 
        home_beach_id: null,
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
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
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
    });

    const { container } = render(<HomeBeachBanner selectedBeachId={selectedBeachId} />);

    expect(container.firstChild).toBeNull();
  });

  it("calls setHomeBeach action when button is clicked", async () => {
    mockUseProfile.mockReturnValue({
      profile: { 
        id: "test-user-id", 
        home_beach_id: null,
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
    });

    render(<HomeBeachBanner selectedBeachId={selectedBeachId} />);

    const button = screen.getByTestId("set-home-beach");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSetHomeBeach).toHaveBeenCalledWith(selectedBeachId);
    });

    // Should also trigger profile refetch
    expect(mockMutate).toHaveBeenCalled();
  });

  it("shows saving state when action is in progress", async () => {
    // Make the action slow to resolve
    mockSetHomeBeach.mockImplementation(() => new Promise(resolve => 
      setTimeout(() => resolve({
        success: true,
        data: { id: "test-user-id", home_beach_id: selectedBeachId, full_name: "Test User" }
      }), 100)
    ));

    mockUseProfile.mockReturnValue({
      profile: { 
        id: "test-user-id", 
        home_beach_id: null,
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: mockMutate
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