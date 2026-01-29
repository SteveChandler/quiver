import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrimaryActions, ShareData } from "@/components/home-screen/primary-actions";

// Mock framer-motion to avoid animation issues in tests
jest.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ShareSheet component
jest.mock("@/components/share/share-sheet", () => ({
  ShareSheet: ({ open, onOpenChange, imageUrl, title, text }: any) =>
    open ? (
      <div data-testid="share-sheet" data-image-url={imageUrl} data-title={title} data-text={text}>
        <button data-testid="close-share-sheet" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

describe("PrimaryActions", () => {
  const mockRecommendation = {
    beach: { id: "test-beach", name: "Test Beach" },
    score: 85,
    window: { start: new Date(), end: new Date(), timezone: "America/Los_Angeles" },
  } as any;

  const defaultProps = {
    topRecommendation: mockRecommendation,
    onAtBeach: jest.fn(),
    onPlanWeekend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders both action buttons", () => {
    render(<PrimaryActions {...defaultProps} />);

    expect(screen.getByTestId("at-beach-button")).toBeInTheDocument();
    expect(screen.getByTestId("plan-weekend-button")).toBeInTheDocument();
  });

  it("calls onAtBeach when primary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("at-beach-button"));

    expect(defaultProps.onAtBeach).toHaveBeenCalled();
  });

  it("calls onPlanWeekend when secondary button clicked", async () => {
    const user = userEvent.setup();
    render(<PrimaryActions {...defaultProps} />);

    await user.click(screen.getByTestId("plan-weekend-button"));

    expect(defaultProps.onPlanWeekend).toHaveBeenCalled();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<PrimaryActions {...defaultProps} disabled />);

    expect(screen.getByTestId("at-beach-button")).toBeDisabled();
    expect(screen.getByTestId("plan-weekend-button")).toBeDisabled();
  });

  it("has gradient background on primary button", () => {
    render(<PrimaryActions {...defaultProps} />);

    const primaryButton = screen.getByTestId("at-beach-button");
    expect(primaryButton.className).toMatch(/bg-gradient/);
  });

  describe("Share button", () => {
    const mockShareData: ShareData = {
      imageUrl: "https://example.com/og-image.png",
      beachName: "Test Beach",
      title: "Check out Test Beach!",
      text: "Test Beach is a good option at 8.5/10",
    };

    it("renders when shareData is provided", () => {
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} />);

      expect(screen.getByTestId("share-button")).toBeInTheDocument();
    });

    it("does not render when shareData is null", () => {
      render(<PrimaryActions {...defaultProps} shareData={null} />);

      expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
    });

    it("does not render when shareData is undefined", () => {
      render(<PrimaryActions {...defaultProps} />);

      expect(screen.queryByTestId("share-button")).not.toBeInTheDocument();
    });

    it("opens ShareSheet when clicked", async () => {
      const user = userEvent.setup();
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} />);

      // ShareSheet should not be visible initially
      expect(screen.queryByTestId("share-sheet")).not.toBeInTheDocument();

      // Click share button
      await user.click(screen.getByTestId("share-button"));

      // ShareSheet should now be visible
      expect(screen.getByTestId("share-sheet")).toBeInTheDocument();
    });

    it("passes correct props to ShareSheet", async () => {
      const user = userEvent.setup();
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} />);

      await user.click(screen.getByTestId("share-button"));

      const shareSheet = screen.getByTestId("share-sheet");
      expect(shareSheet).toHaveAttribute("data-image-url", mockShareData.imageUrl);
      expect(shareSheet).toHaveAttribute("data-title", mockShareData.title);
      expect(shareSheet).toHaveAttribute("data-text", mockShareData.text);
    });

    it("is disabled when disabled prop is true", () => {
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} disabled />);

      expect(screen.getByTestId("share-button")).toBeDisabled();
    });

    it("has proper accessibility attributes", () => {
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} />);

      const shareButton = screen.getByTestId("share-button");
      expect(shareButton).toHaveAttribute("aria-label", "Share forecast");
    });

    it("closes ShareSheet when onOpenChange is called with false", async () => {
      const user = userEvent.setup();
      render(<PrimaryActions {...defaultProps} shareData={mockShareData} />);

      // Open share sheet
      await user.click(screen.getByTestId("share-button"));
      expect(screen.getByTestId("share-sheet")).toBeInTheDocument();

      // Close share sheet
      await user.click(screen.getByTestId("close-share-sheet"));
      expect(screen.queryByTestId("share-sheet")).not.toBeInTheDocument();
    });
  });
});
