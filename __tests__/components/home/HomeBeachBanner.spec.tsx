import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeBeachBanner } from "@/components/home/HomeBeachBanner";

// Mock the useProfile hook
const mockMutate = jest.fn();
const mockUseProfile = jest.fn();

jest.mock("@/lib/hooks/useProfile", () => ({
  useProfile: () => mockUseProfile(),
}));

describe("HomeBeachBanner", () => {
  const selectedBeachId = "test-beach-123";

  beforeEach(() => {
    jest.clearAllMocks();
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
      <HomeBeachBanner selectedBeachId={selectedBeachId} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("triggers profile refresh when button is clicked", async () => {
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

    const user = userEvent.setup();
    await user.click(screen.getByTestId("set-home-beach"));

    expect(mockMutate).toHaveBeenCalled();
  });
});
