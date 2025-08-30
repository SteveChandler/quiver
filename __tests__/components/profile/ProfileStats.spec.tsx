import React from "react";
import { render, screen } from "@testing-library/react";
import { HomeBeachTile } from "@/components/profile/HomeBeachTile";
import { useProfile } from "@/lib/hooks/useProfile";

// Mock the useProfile hook
jest.mock("@/lib/hooks/useProfile");

const mockUseProfile = useProfile as jest.MockedFunction<typeof useProfile>;

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
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: true,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByText("Home Break")).toBeInTheDocument();
  });

  it("renders home beach name when set", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        default_beach_id: "beach-123",
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("Ocean Beach");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("renders dash when home beach is not set", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        default_beach_id: null,
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("renders dash when beach lookup fails", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        default_beach_id: "unknown-beach-id",
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile beachLookup={mockBeachLookup} />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("works without beach lookup provided", () => {
    mockUseProfile.mockReturnValue({
      profile: {
        id: "test-user-id",
        default_beach_id: "beach-123",
        full_name: "Test User"
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile />);

    expect(screen.getByTestId("home-break-value")).toHaveTextContent("—");
    expect(screen.getByText("From profile")).toBeInTheDocument();
  });

  it("displays the home break section title and icon", () => {
    mockUseProfile.mockReturnValue({
      profile: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
      mutate: jest.fn()
    });

    render(<HomeBeachTile />);

    expect(screen.getByText("Home Break")).toBeInTheDocument();
    // MapPin icon should be present (we can't test the icon directly, but we can verify the structure)
    const cardHeader = screen.getByText("Home Break").closest("div");
    expect(cardHeader).toHaveClass("flex", "flex-row", "items-center", "justify-between");
  });
});