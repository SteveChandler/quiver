import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionShareButton } from "@/components/session/session-share-button";
import "@testing-library/jest-dom";

describe("SessionShareButton", () => {
  const defaultProps = {
    sessionId: "test-session-123",
    shareCount: 5,
    onShareClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render share button with correct attributes", () => {
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("aria-label", "Share this session. Currently shared 5 times");
    });

    it("should display share count", () => {
      render(<SessionShareButton {...defaultProps} />);

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("should handle singular share count in aria-label", () => {
      render(<SessionShareButton {...defaultProps} shareCount={1} />);

      const button = screen.getByTestId("share-button");
      expect(button).toHaveAttribute("aria-label", "Share this session. Currently shared 1 time");
    });

    it("should handle zero shares", () => {
      render(<SessionShareButton {...defaultProps} shareCount={0} />);

      expect(screen.getByText("0")).toBeInTheDocument();
      const button = screen.getByTestId("share-button");
      expect(button).toHaveAttribute("aria-label", "Share this session. Currently shared 0 times");
    });

    it("should render Share2 icon", () => {
      const { container } = render(<SessionShareButton {...defaultProps} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("should render small size button", () => {
      const { container } = render(
        <SessionShareButton {...defaultProps} size="sm" />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });

    it("should render medium size button", () => {
      const { container } = render(
        <SessionShareButton {...defaultProps} size="md" />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });

    it("should render large size button", () => {
      const { container } = render(
        <SessionShareButton {...defaultProps} size="lg" />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-5", "w-5");
    });

    it("should default to medium size", () => {
      const { container } = render(
        <SessionShareButton
          sessionId={defaultProps.sessionId}
          shareCount={defaultProps.shareCount}
          onShareClick={defaultProps.onShareClick}
        />
      );

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });
  });

  describe("User interactions", () => {
    it("should call onShareClick when button is clicked", async () => {
      const mockOnShareClick = jest.fn();
      const user = userEvent.setup();

      render(
        <SessionShareButton {...defaultProps} onShareClick={mockOnShareClick} />
      );

      const button = screen.getByTestId("share-button");
      await user.click(button);

      expect(mockOnShareClick).toHaveBeenCalledTimes(1);
    });

    it("should prevent event propagation on click", () => {
      const mockOnShareClick = jest.fn();
      const mockStopPropagation = jest.fn();
      const mockPreventDefault = jest.fn();

      render(
        <SessionShareButton {...defaultProps} onShareClick={mockOnShareClick} />
      );

      const button = screen.getByTestId("share-button");
      fireEvent.click(button, {
        stopPropagation: mockStopPropagation,
        preventDefault: mockPreventDefault,
      });

      expect(mockOnShareClick).toHaveBeenCalled();
    });
  });

  describe("Animation", () => {
    it("should trigger animation on click", async () => {
      const user = userEvent.setup();
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");

      // Initial state - no animation
      expect(button).toHaveStyle({ transform: "scale(1)" });

      // Click the button
      await user.click(button);

      // Animation should trigger (scale-110 class applied)
      expect(button).toHaveClass("scale-110");
    });

    it("should reset animation after 300ms", async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      await user.click(button);

      // Should have animation class
      expect(button).toHaveClass("scale-110");

      // Fast-forward time
      jest.advanceTimersByTime(300);

      // Animation class should be removed
      await waitFor(() => {
        expect(button).not.toHaveClass("scale-110");
      });

      jest.useRealTimers();
    });

    it("should rotate icon during animation", async () => {
      const user = userEvent.setup();
      const { container } = render(<SessionShareButton {...defaultProps} />);

      const icon = container.querySelector("svg");
      const button = screen.getByTestId("share-button");

      // Initial state - no rotation
      expect(icon).not.toHaveClass("rotate-12");

      // Click the button
      await user.click(button);

      // Icon should rotate during animation
      await waitFor(() => {
        expect(icon).toHaveClass("rotate-12");
      });
    });
  });

  describe("Styling", () => {
    it("should apply custom className", () => {
      render(
        <SessionShareButton {...defaultProps} className="custom-test-class" />
      );

      const button = screen.getByTestId("share-button");
      expect(button).toHaveClass("custom-test-class");
    });

    it("should have default motion-optimized class", () => {
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      expect(button).toHaveClass("motion-optimized");
    });

    it("should have hover:text-primary class", () => {
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      expect(button).toHaveClass("hover:text-primary");
    });

    it("should have text-muted-foreground class", () => {
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      expect(button).toHaveClass("text-muted-foreground");
    });
  });

  describe("Accessibility", () => {
    it("should be keyboard accessible", async () => {
      const mockOnShareClick = jest.fn();
      const user = userEvent.setup();

      render(
        <SessionShareButton {...defaultProps} onShareClick={mockOnShareClick} />
      );

      const button = screen.getByTestId("share-button");

      // Focus the button
      button.focus();
      expect(button).toHaveFocus();

      // Press Enter
      await user.keyboard("{Enter}");
      expect(mockOnShareClick).toHaveBeenCalled();
    });

    it("should have descriptive aria-label", () => {
      render(<SessionShareButton {...defaultProps} shareCount={42} />);

      const button = screen.getByTestId("share-button");
      expect(button).toHaveAttribute(
        "aria-label",
        "Share this session. Currently shared 42 times"
      );
    });

    it("should be a button element", () => {
      render(<SessionShareButton {...defaultProps} />);

      const button = screen.getByTestId("share-button");
      expect(button.tagName).toBe("BUTTON");
    });
  });

  describe("Multiple clicks", () => {
    it("should handle rapid clicks", async () => {
      const mockOnShareClick = jest.fn();
      const user = userEvent.setup();

      render(
        <SessionShareButton {...defaultProps} onShareClick={mockOnShareClick} />
      );

      const button = screen.getByTestId("share-button");

      // Click multiple times rapidly
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should call handler for each click
      expect(mockOnShareClick).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge cases", () => {
    it("should handle very large share counts", () => {
      render(<SessionShareButton {...defaultProps} shareCount={999999} />);

      expect(screen.getByText("999999")).toBeInTheDocument();
    });

    it("should handle negative share counts gracefully", () => {
      render(<SessionShareButton {...defaultProps} shareCount={-1} />);

      expect(screen.getByText("-1")).toBeInTheDocument();
    });

    it("should render without crashing when sessionId is empty", () => {
      expect(() =>
        render(
          <SessionShareButton
            sessionId=""
            shareCount={5}
            onShareClick={jest.fn()}
          />
        )
      ).not.toThrow();
    });
  });
});
