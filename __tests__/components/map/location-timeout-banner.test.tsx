import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationTimeoutBanner } from "@/components/map/location-timeout-banner";

const STORAGE_KEY = "quiver_location_timeout_dismissed";

describe("LocationTimeoutBanner", () => {
  const mockOnGrantLocation = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should render banner with correct content", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    expect(screen.getByTestId("location-timeout-banner")).toBeInTheDocument();
    expect(screen.getByText("Using Default Location")).toBeInTheDocument();
    expect(
      screen.getByText(/showing beaches near Ocean Beach, San Diego/i)
    ).toBeInTheDocument();
  });

  it("should render Grant Location Access button", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const grantButton = screen.getByRole("button", {
      name: /grant location access/i,
    });
    expect(grantButton).toBeInTheDocument();
  });

  it("should render Dismiss button", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const dismissButtons = screen.getAllByRole("button");
    const dismissButton = dismissButtons.find((button) =>
      button.textContent?.includes("Dismiss")
    );
    expect(dismissButton).toBeInTheDocument();
  });

  it("should render X dismiss button", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const xButton = screen.getByTestId("dismiss-banner-button");
    expect(xButton).toBeInTheDocument();
  });

  it("should call onGrantLocation when Grant Location Access button is clicked", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const grantButton = screen.getByRole("button", {
      name: /grant location access/i,
    });
    fireEvent.click(grantButton);

    expect(mockOnGrantLocation).toHaveBeenCalledTimes(1);
  });

  it("should hide banner when Dismiss button is clicked", async () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const dismissButton = screen.getByText("Dismiss");
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId("location-timeout-banner")
      ).not.toBeInTheDocument();
    });
  });

  it("should hide banner when X button is clicked", async () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const xButton = screen.getByTestId("dismiss-banner-button");
    fireEvent.click(xButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId("location-timeout-banner")
      ).not.toBeInTheDocument();
    });
  });

  it("should persist dismissed state in localStorage", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const dismissButton = screen.getByText("Dismiss");
    fireEvent.click(dismissButton);

    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("should not render banner if already dismissed in localStorage", () => {
    // Pre-set dismissed state
    localStorage.setItem(STORAGE_KEY, "true");

    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    expect(
      screen.queryByTestId("location-timeout-banner")
    ).not.toBeInTheDocument();
  });

  it("should clear dismissed state when Grant Location Access is clicked", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    // Click Grant Location Access without dismissing first
    const grantButton = screen.getByRole("button", {
      name: /grant location access/i,
    });
    fireEvent.click(grantButton);

    // localStorage should be cleared (or remain empty)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockOnGrantLocation).toHaveBeenCalledTimes(1);

    // Test that it clears even if previously dismissed
    localStorage.setItem(STORAGE_KEY, "true");
    fireEvent.click(grantButton);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockOnGrantLocation).toHaveBeenCalledTimes(2);
  });

  it("should have proper accessibility attributes", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const banner = screen.getByTestId("location-timeout-banner");
    expect(banner).toHaveAttribute("role", "alert");

    const xButton = screen.getByTestId("dismiss-banner-button");
    expect(xButton).toHaveAttribute("aria-label", "Dismiss banner");
  });

  it("should display MapPin icon", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    // MapPin icons should be present (one in alert, one in button)
    const banner = screen.getByTestId("location-timeout-banner");
    const svgs = banner.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("should have appropriate styling classes", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const banner = screen.getByTestId("location-timeout-banner");
    expect(banner).toHaveClass("bg-amber-50");
    expect(banner).toHaveClass("border-amber-200");
  });

  it("should handle rapid dismiss clicks gracefully", async () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const dismissButton = screen.getByText("Dismiss");

    // Click dismiss multiple times rapidly
    fireEvent.click(dismissButton);
    fireEvent.click(dismissButton);
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(
        screen.queryByTestId("location-timeout-banner")
      ).not.toBeInTheDocument();
    });

    // Should only set localStorage once
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("should handle missing localStorage gracefully", () => {
    // Mock localStorage to throw errors
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn(() => {
          throw new Error("localStorage not available");
        }),
        setItem: jest.fn(() => {
          throw new Error("localStorage not available");
        }),
        removeItem: jest.fn(() => {
          throw new Error("localStorage not available");
        }),
        clear: jest.fn(),
      },
      writable: true,
    });

    // Should still render without crashing
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    expect(screen.getByTestId("location-timeout-banner")).toBeInTheDocument();

    // Restore original localStorage
    Object.defineProperty(window, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  it("should maintain banner visibility after grant location is called", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const grantButton = screen.getByRole("button", {
      name: /grant location access/i,
    });
    fireEvent.click(grantButton);

    // Banner should still be visible (parent component controls visibility based on hasTimedOut state)
    expect(screen.getByTestId("location-timeout-banner")).toBeInTheDocument();
    expect(mockOnGrantLocation).toHaveBeenCalled();
  });

  it("should have correct button variants and styling", () => {
    render(<LocationTimeoutBanner onGrantLocation={mockOnGrantLocation} />);

    const grantButton = screen.getByRole("button", {
      name: /grant location access/i,
    });
    const dismissButton = screen.getByText("Dismiss");

    // Grant button should have primary styling
    expect(grantButton).toHaveClass("bg-amber-600");

    // Dismiss button should have ghost variant styling
    expect(dismissButton).toHaveClass("text-amber-700");
  });
});
