import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import StorageUsageWidget from "@/components/media/storage-usage-widget";
import { getStorageStatsAction } from "@/actions/session-media-actions";

// Mock the server action
jest.mock("@/actions/session-media-actions", () => ({
  getStorageStatsAction: jest.fn(),
}));

const mockGetStorageStatsAction = getStorageStatsAction as jest.MockedFunction<
  typeof getStorageStatsAction
>;

describe("StorageUsageWidget", () => {
  const defaultProps = {
    className: "test-class",
    showDetails: true,
    refreshTrigger: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockGetStorageStatsAction.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<StorageUsageWidget {...defaultProps} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("displays storage statistics correctly", async () => {
    const mockStats = {
      total_bytes: 25 * 1024 * 1024, // 25MB
      image_count: 15,
      remaining_bytes: 75 * 1024 * 1024, // 75MB
      usage_percentage: 25.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage")).toBeInTheDocument();
      expect(screen.getByText("25 MB used")).toBeInTheDocument();
      expect(screen.getByText("25%")).toBeInTheDocument();
      expect(screen.getByText("15")).toBeInTheDocument(); // Image count
      expect(screen.getByText("75 MB")).toBeInTheDocument(); // Remaining
    });
  });

  it("shows warning when storage is near limit (75-89%)", async () => {
    const mockStats = {
      total_bytes: 80 * 1024 * 1024, // 80MB
      image_count: 40,
      remaining_bytes: 20 * 1024 * 1024, // 20MB
      usage_percentage: 80.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Storage is nearly full/)).toBeInTheDocument();
      expect(
        screen.getByText(/Consider deleting unused images/)
      ).toBeInTheDocument();
    });
  });

  it("shows critical warning when storage is at limit (90%+)", async () => {
    const mockStats = {
      total_bytes: 95 * 1024 * 1024, // 95MB
      image_count: 50,
      remaining_bytes: 5 * 1024 * 1024, // 5MB
      usage_percentage: 95.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Storage limit reached/)).toBeInTheDocument();
      expect(
        screen.getByText(/Delete some images to upload new ones/)
      ).toBeInTheDocument();
    });
  });

  it("shows storage tips when usage is low", async () => {
    const mockStats = {
      total_bytes: 10 * 1024 * 1024, // 10MB
      image_count: 5,
      remaining_bytes: 90 * 1024 * 1024, // 90MB
      usage_percentage: 10.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Images are compressed to 80% quality/)
      ).toBeInTheDocument();
    });
  });

  it("handles error state", async () => {
    mockGetStorageStatsAction.mockResolvedValue({
      success: false,
      error: "Failed to load storage stats",
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load storage stats")
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("handles API error", async () => {
    mockGetStorageStatsAction.mockRejectedValue(new Error("Network error"));

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load storage stats")
      ).toBeInTheDocument();
    });
  });

  it("renders without details when showDetails is false", async () => {
    const mockStats = {
      total_bytes: 25 * 1024 * 1024,
      image_count: 15,
      remaining_bytes: 75 * 1024 * 1024,
      usage_percentage: 25.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} showDetails={false} />);

    await waitFor(() => {
      expect(screen.getByText("25 MB used")).toBeInTheDocument();
      expect(screen.getByText("25%")).toBeInTheDocument();
    });

    // Should not show detailed stats
    expect(screen.queryByText("Storage Usage")).not.toBeInTheDocument();
    expect(screen.queryByText("Images")).not.toBeInTheDocument();
    expect(screen.queryByText("Remaining")).not.toBeInTheDocument();
  });

  it("refreshes data when refreshTrigger changes", async () => {
    const mockStats = {
      total_bytes: 25 * 1024 * 1024,
      image_count: 15,
      remaining_bytes: 75 * 1024 * 1024,
      usage_percentage: 25.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    const { rerender } = render(
      <StorageUsageWidget {...defaultProps} refreshTrigger={0} />
    );

    await waitFor(() => {
      expect(mockGetStorageStatsAction).toHaveBeenCalledTimes(1);
    });

    // Change refresh trigger
    rerender(<StorageUsageWidget {...defaultProps} refreshTrigger={1} />);

    await waitFor(() => {
      expect(mockGetStorageStatsAction).toHaveBeenCalledTimes(2);
    });
  });

  it("applies custom className", async () => {
    const mockStats = {
      total_bytes: 25 * 1024 * 1024,
      image_count: 15,
      remaining_bytes: 75 * 1024 * 1024,
      usage_percentage: 25.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget className="custom-class" />);

    await waitFor(() => {
      const widget = screen.getByText("25 MB used").closest(".custom-class");
      expect(widget).toBeInTheDocument();
    });
  });

  it("formats file sizes correctly", async () => {
    const testCases = [
      {
        stats: {
          total_bytes: 1024, // 1KB
          image_count: 1,
          remaining_bytes: 99 * 1024 * 1024,
          usage_percentage: 0.001,
        },
        expectedUsed: "1 KB used",
      },
      {
        stats: {
          total_bytes: 1024 * 1024, // 1MB
          image_count: 5,
          remaining_bytes: 99 * 1024 * 1024,
          usage_percentage: 1.0,
        },
        expectedUsed: "1 MB used",
      },
      {
        stats: {
          total_bytes: 1.5 * 1024 * 1024, // 1.5MB
          image_count: 8,
          remaining_bytes: 98.5 * 1024 * 1024,
          usage_percentage: 1.5,
        },
        expectedUsed: "1.5 MB used",
      },
    ];

    for (const testCase of testCases) {
      mockGetStorageStatsAction.mockResolvedValue({
        success: true,
        data: testCase.stats,
      });

      const { unmount } = render(<StorageUsageWidget {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(testCase.expectedUsed)).toBeInTheDocument();
      });

      unmount();
      jest.clearAllMocks();
    }
  });

  it("shows correct progress bar color based on usage", async () => {
    const testCases = [
      { percentage: 50, expectedColorClass: "bg-green-500" },
      { percentage: 80, expectedColorClass: "bg-yellow-500" },
      { percentage: 95, expectedColorClass: "bg-red-500" },
    ];

    for (const testCase of testCases) {
      const mockStats = {
        total_bytes: testCase.percentage * 1024 * 1024,
        image_count: 10,
        remaining_bytes: (100 - testCase.percentage) * 1024 * 1024,
        usage_percentage: testCase.percentage,
      };

      mockGetStorageStatsAction.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const { unmount } = render(<StorageUsageWidget {...defaultProps} />);

      await waitFor(() => {
        const progressElement = document.querySelector(
          `.${testCase.expectedColorClass}`
        );
        expect(progressElement).toBeInTheDocument();
      });

      unmount();
      jest.clearAllMocks();
    }
  });

  it("shows tooltip with helpful information", async () => {
    const mockStats = {
      total_bytes: 25 * 1024 * 1024,
      image_count: 15,
      remaining_bytes: 75 * 1024 * 1024,
      usage_percentage: 25.0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Storage Usage")).toBeInTheDocument();
    });

    // The tooltip should be present in the DOM (even if not visible)
    expect(
      screen.getByText(/Free tier includes 100MB of storage/)
    ).toBeInTheDocument();
  });

  it("returns null when no stats are available", async () => {
    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: null,
    });

    const { container } = render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("handles zero byte usage correctly", async () => {
    const mockStats = {
      total_bytes: 0,
      image_count: 0,
      remaining_bytes: 100 * 1024 * 1024,
      usage_percentage: 0,
    };

    mockGetStorageStatsAction.mockResolvedValue({
      success: true,
      data: mockStats,
    });

    render(<StorageUsageWidget {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("0 Bytes used")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument(); // Image count
    });
  });
});
