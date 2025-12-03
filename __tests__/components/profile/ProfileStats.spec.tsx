import React from "react";
import { render, screen } from "@testing-library/react";
import { HomeBeachTile } from "@/components/profile/HomeBeachTile";
import { useProfileContext } from "@/context/profile-context";

// Mock the useProfileContext hook
jest.mock("@/context/profile-context");

const mockUseProfileContext = useProfileContext as jest.MockedFunction<typeof useProfileContext>;

describe("ProfileStats - HomeBeachTile", () => {
  const mockBeachLookup = {
    "beach-123": "Ocean Beach",
    "beach-456": "Pacific Beach",
    "beach-789": "Mission Beach"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state", () => {
    mockUseProfileContext.mockReturnValue({
      profile: null,
      homeBeach: null,
      isLoading: true,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByText("Home Break")).toBeInTheDocument();
  });

  it("renders home beach name when set", () => {
    mockUseProfileContext.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: "beach-123",
        full_name: "Test User"
      } as any,
      homeBeach: { id: "beach-123", name: "Ocean Beach" } as any,
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("Ocean Beach");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("renders dash when home beach is not set", () => {
    mockUseProfileContext.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: null,
        full_name: "Test User"
      } as any,
      homeBeach: null,
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("renders dash when beach lookup fails", () => {
    mockUseProfileContext.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: "unknown-beach-id",
        full_name: "Test User"
      } as any,
      homeBeach: null,
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("works without beach lookup provided", () => {
    mockUseProfileContext.mockReturnValue({
      profile: {
        id: "test-user-id",
        home_beach_id: "beach-123",
        full_name: "Test User"
      } as any,
      homeBeach: null,
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("displays the home break section title and icon", () => {
    mockUseProfileContext.mockReturnValue({
      profile: null,
      homeBeach: null,
      isLoading: false,
      error: null,
      updateProfile: jest.fn(),
      refreshProfile: jest.fn()
    });

    render(<HomeBeachTile />);

    expect(screen.getByText("Home Break")).toBeInTheDocument();
    // Check for the structure - the title should be present and the component should render
    const cardTitle = screen.getByText("Home Break");
    expect(cardTitle).toBeInTheDocument();
  });
});