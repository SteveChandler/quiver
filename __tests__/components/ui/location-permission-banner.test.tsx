import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocationPermissionBanner } from "@/components/ui/location-permission-banner";

const STORAGE_KEY = "quiver_location_permission_dismissed";

describe("LocationPermissionBanner", () => {
  const mockOnRetry = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("renders correctly for each error type", () => {
    it("should render denied error correctly", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      expect(screen.getByTestId("location-permission-banner")).toBeInTheDocument();
      expect(screen.getByText("Location Access Denied")).toBeInTheDocument();
      expect(
        screen.getByText(/grant permission for personalized beach recommendations/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /grant location access/i })).toBeInTheDocument();
    });

    it("should render unavailable error correctly", () => {
      render(<LocationPermissionBanner errorType="unavailable" onRetry={mockOnRetry} />);

      expect(screen.getByText("Location Unavailable")).toBeInTheDocument();
      expect(
        screen.getByText(/your device location couldn't be determined/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("should render timeout error correctly", () => {
      render(<LocationPermissionBanner errorType="timeout" onRetry={mockOnRetry} />);

      expect(screen.getByText("Location Request Timed Out")).toBeInTheDocument();
      expect(
        screen.getByText(/the location request took too long/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe("button interactions", () => {
    it("should call onRetry when retry button is clicked", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const retryButton = screen.getByTestId("location-permission-retry-button");
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("should call onDismiss when dismiss text button is clicked", () => {
      render(
        <LocationPermissionBanner
          errorType="denied"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      const dismissButton = screen.getByTestId("location-permission-dismiss-text-button");
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it("should call onDismiss when X button is clicked", () => {
      render(
        <LocationPermissionBanner
          errorType="denied"
          onRetry={mockOnRetry}
          onDismiss={mockOnDismiss}
        />
      );

      const xButton = screen.getByTestId("location-permission-dismiss-button");
      fireEvent.click(xButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("dismiss behavior", () => {
    it("should hide banner when Dismiss button is clicked", async () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const dismissButton = screen.getByTestId("location-permission-dismiss-text-button");
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId("location-permission-banner")
        ).not.toBeInTheDocument();
      });
    });

    it("should hide banner when X button is clicked", async () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const xButton = screen.getByTestId("location-permission-dismiss-button");
      fireEvent.click(xButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId("location-permission-banner")
        ).not.toBeInTheDocument();
      });
    });

    it("should persist dismissed state in localStorage", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const dismissButton = screen.getByTestId("location-permission-dismiss-text-button");
      fireEvent.click(dismissButton);

      expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    });

    it("should not render banner if already dismissed in localStorage", () => {
      localStorage.setItem(STORAGE_KEY, "true");

      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      expect(
        screen.queryByTestId("location-permission-banner")
      ).not.toBeInTheDocument();
    });
  });

  describe("retry behavior", () => {
    it("should clear dismissed state when retry is clicked", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      // Set dismissed state first
      localStorage.setItem(STORAGE_KEY, "true");

      const retryButton = screen.getByTestId("location-permission-retry-button");
      fireEvent.click(retryButton);

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("should keep banner visible after retry is clicked", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const retryButton = screen.getByTestId("location-permission-retry-button");
      fireEvent.click(retryButton);

      expect(screen.getByTestId("location-permission-banner")).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it("should have proper accessibility attributes", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const banner = screen.getByTestId("location-permission-banner");
      expect(banner).toHaveAttribute("role", "alert");

      const xButton = screen.getByTestId("location-permission-dismiss-button");
      expect(xButton).toHaveAttribute("aria-label", "Dismiss banner");
    });

    it("should have appropriate styling classes", () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const banner = screen.getByTestId("location-permission-banner");
      expect(banner).toHaveClass("bg-amber-50");
      expect(banner).toHaveClass("border-amber-200");
    });
  });

  describe("error handling", () => {
    it("should handle missing localStorage gracefully", () => {
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

      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      expect(screen.getByTestId("location-permission-banner")).toBeInTheDocument();

      Object.defineProperty(window, "localStorage", {
        value: originalLocalStorage,
        writable: true,
      });
    });

    it("should handle rapid dismiss clicks gracefully", async () => {
      render(<LocationPermissionBanner errorType="denied" onRetry={mockOnRetry} />);

      const dismissButton = screen.getByTestId("location-permission-dismiss-text-button");

      fireEvent.click(dismissButton);
      fireEvent.click(dismissButton);
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(
          screen.queryByTestId("location-permission-banner")
        ).not.toBeInTheDocument();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
    });
  });
});
