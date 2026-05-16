import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SurfHighlightsSection } from "@/components/landing-page/surf-highlights-section";

const mockRequestPreciseLocation = jest.fn();
const mockClearError = jest.fn();

let mockLocationCtx: Record<string, unknown> | null = {};

jest.mock("@/context/location-context", () => ({
  useLocationSafe: () => mockLocationCtx,
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: () => ({
    data: { spots: [], isNearby: false },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock("framer-motion", () => ({
  motion: {
    h2: ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h2 {...props}>{children}</h2>
    ),
    p: ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...props}>{children}</p>
    ),
    div: ({ children, initial, animate, transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  useInView: () => true,
  useReducedMotion: () => false,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));
jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockLocationCtx = {
    location: {
      displayName: "Unknown",
      coordinates: { lat: 38.9, lon: -77.0 },
      source: "ip" as const,
      isLoading: false,
    },
    hasPreciseLocation: false,
    requestPreciseLocation: mockRequestPreciseLocation,
    locationError: null,
    clearError: mockClearError,
  };
});

describe("SurfHighlightsSection location prompt", () => {
  it("shows 'Show spots near me' button when precise location not granted", () => {
    render(<SurfHighlightsSection />);
    expect(screen.getByRole("button", { name: /show spots near me/i })).toBeInTheDocument();
  });

  it("hides the button when precise location is already granted", () => {
    mockLocationCtx!.hasPreciseLocation = true;
    render(<SurfHighlightsSection />);
    expect(screen.queryByRole("button", { name: /show spots near me/i })).not.toBeInTheDocument();
  });

  it("calls requestPreciseLocation when button is clicked", async () => {
    mockRequestPreciseLocation.mockResolvedValue(undefined);
    render(<SurfHighlightsSection />);
    fireEvent.click(screen.getByRole("button", { name: /show spots near me/i }));
    expect(mockRequestPreciseLocation).toHaveBeenCalledTimes(1);
  });

  it("shows error message when location is denied", () => {
    mockLocationCtx!.locationError = "Location access was denied";
    render(<SurfHighlightsSection />);
    expect(screen.getByText(/location access was denied/i)).toBeInTheDocument();
  });

  it("shows 'Locating...' text while requesting", async () => {
    mockRequestPreciseLocation.mockReturnValue(new Promise(() => {}));
    render(<SurfHighlightsSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /show spots near me/i }));
    });
    expect(screen.getByRole("button", { name: /locating/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /locating/i })).toBeDisabled();
  });

  it("hides button when location context is unavailable", () => {
    mockLocationCtx = null;
    render(<SurfHighlightsSection />);
    expect(screen.queryByRole("button", { name: /show spots near me/i })).not.toBeInTheDocument();
  });
});
