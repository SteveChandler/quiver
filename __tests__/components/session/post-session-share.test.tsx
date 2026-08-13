/**
 * Tests for PostSessionShare Component
 *
 * Covers rendering, star display, callback invocation, accessibility,
 * and the OG share card preview introduced in Phase 1D.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostSessionShare } from "@/components/session/post-session-share";

// Mock framer-motion to avoid animation complexity in tests
jest.mock("framer-motion", () => {
  const React = require("react");
  return {
    useReducedMotion: () => false,
    motion: {
      div: React.forwardRef(
        (props: Record<string, unknown>, ref: React.Ref<HTMLDivElement>) => {
          const {
            variants: _variants,
            initial: _initial,
            animate: _animate,
            transition: _transition,
            whileInView: _whileInView,
            ...rest
          } = props;
          return <div ref={ref} {...rest} />;
        }
      ),
    },
  };
});

// Mock canvas-confetti so it doesn't blow up in jsdom
jest.mock("canvas-confetti", () => jest.fn());

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    androidLabel,
    iosLabel,
    platform,
    placement,
    source,
    surface,
  }: {
    androidLabel?: string;
    iosLabel?: string;
    platform: "ios" | "android" | "desktop";
    placement?: string;
    source: string;
    surface: string;
  }) => {
    const label =
      platform === "android"
        ? androidLabel
        : platform === "ios"
          ? iosLabel
          : "Get Quiver";

    return (
      <a
        data-placement={placement}
        data-platform={platform}
        data-source={source}
        data-surface={surface}
        href={platform === "android" ? "/android-beta" : "/download"}
      >
        {label}
      </a>
    );
  },
}));

jest.mock("@/lib/analytics/web-context", () => ({
  getFirstTouchPlatform: jest.fn(() => "android"),
}));

const defaultProps = {
  beachName: "Ocean Beach",
  overallRating: 4,
  waveSize: "Waist-Chest",
  onShare: jest.fn(),
  onSkip: jest.fn(),
};

const SHARE_CARD_URL =
  "http://localhost:3000/api/og/session?beach=Ocean+Beach&rating=4&stars=4&size=Waist-Chest&board=";

describe("PostSessionShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Provide a matchMedia stub for prefers-reduced-motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  describe("Rendering", () => {
    it("renders beach name", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
    });

    it("renders wave size", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(screen.getByText("Waist-Chest")).toBeInTheDocument();
    });

    it("renders 'Session Logged' headline", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(screen.getByText("Session Logged")).toBeInTheDocument();
    });

    it("renders 'Share Your Session' primary button", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /share your session/i })
      ).toBeInTheDocument();
    });

    it("renders 'Skip' secondary button", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(screen.getByRole("button", { name: /skip/i })).toBeInTheDocument();
    });

    it("renders a post-log native app CTA with session attribution", async () => {
      render(<PostSessionShare {...defaultProps} />);

      const nativeAppCta = await screen.findByRole("link", {
        name: "Get the Android beta",
      });

      expect(nativeAppCta).toHaveAttribute("href", "/android-beta");
      expect(nativeAppCta).toHaveAttribute("data-platform", "android");
      expect(nativeAppCta).toHaveAttribute("data-source", "post_session_log");
      expect(nativeAppCta).toHaveAttribute(
        "data-surface",
        "session_log_success"
      );
      expect(nativeAppCta).toHaveAttribute(
        "data-placement",
        "native_app_nudge"
      );
    });

    it("does not render wave size element when waveSize is empty", () => {
      render(<PostSessionShare {...defaultProps} waveSize="" />);
      // Wave size span should not be present
      expect(screen.queryByText("Waist-Chest")).not.toBeInTheDocument();
    });
  });

  describe("OG card preview", () => {
    it("renders an img element when shareCardUrl is provided", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      const img = screen.getByRole("img", { name: /session share card/i });
      expect(img).toBeInTheDocument();
    });

    it("img src points to the provided shareCardUrl", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      const img = screen.getByRole("img", { name: /session share card/i });
      expect(img).toHaveAttribute("src", SHARE_CARD_URL);
    });

    it("does not render img when shareCardUrl is not provided", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(
        screen.queryByRole("img", { name: /session share card/i })
      ).not.toBeInTheDocument();
    });

    it("shows a loading skeleton while the card image is loading", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      // Loading placeholder should be present initially (before onLoad fires)
      expect(screen.getByTestId("share-card-loading")).toBeInTheDocument();
    });

    it("hides the loading skeleton once the image has loaded", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      const img = screen.getByRole("img", { name: /session share card/i });
      // Simulate onLoad
      fireEvent.load(img);
      expect(
        screen.queryByTestId("share-card-loading")
      ).not.toBeInTheDocument();
    });

    it("renders share buttons below the card preview", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      const img = screen.getByRole("img", { name: /session share card/i });
      const shareBtn = screen.getByRole("button", {
        name: /share your session/i,
      });
      // The share button should appear after (below) the image in the DOM
      const shareButtonPosition =
        img.compareDocumentPosition(shareBtn) &
        Node.DOCUMENT_POSITION_FOLLOWING;
      expect(shareButtonPosition).not.toBe(0);
    });

    it("renders 'Your session card is ready' microcopy when shareCardUrl provided", () => {
      render(
        <PostSessionShare {...defaultProps} shareCardUrl={SHARE_CARD_URL} />
      );
      expect(
        screen.getByText(/your session card is ready/i)
      ).toBeInTheDocument();
    });
  });

  describe("Star display", () => {
    it("renders 5 star SVG elements", () => {
      render(<PostSessionShare {...defaultProps} overallRating={3} />);
      // The aria container holding all stars
      const starContainer = screen.getByLabelText("3 out of 5 stars");
      expect(starContainer).toBeInTheDocument();
      const starPaths = starContainer.querySelectorAll("svg");
      expect(starPaths).toHaveLength(5);
    });

    it("labels star container with correct rating", () => {
      render(<PostSessionShare {...defaultProps} overallRating={5} />);
      expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    });

    it("clamps rating above 5 to 5", () => {
      render(<PostSessionShare {...defaultProps} overallRating={99} />);
      expect(screen.getByLabelText("5 out of 5 stars")).toBeInTheDocument();
    });

    it("clamps rating below 0 to 0", () => {
      render(<PostSessionShare {...defaultProps} overallRating={-1} />);
      expect(screen.getByLabelText("0 out of 5 stars")).toBeInTheDocument();
    });

    it("rounds fractional ratings", () => {
      render(<PostSessionShare {...defaultProps} overallRating={3.6} />);
      expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument();
    });
  });

  describe("Callback invocation", () => {
    it("calls onShare when 'Share Your Session' button is clicked", async () => {
      const onShare = jest.fn();
      render(<PostSessionShare {...defaultProps} onShare={onShare} />);

      await userEvent.click(
        screen.getByRole("button", { name: /share your session/i })
      );

      expect(onShare).toHaveBeenCalledTimes(1);
    });

    it("calls onSkip when 'Skip' button is clicked", async () => {
      const onSkip = jest.fn();
      render(<PostSessionShare {...defaultProps} onSkip={onSkip} />);

      await userEvent.click(screen.getByRole("button", { name: /skip/i }));

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("does not call onSkip when only 'Share Your Session' is clicked", async () => {
      const onSkip = jest.fn();
      render(<PostSessionShare {...defaultProps} onSkip={onSkip} />);

      await userEvent.click(
        screen.getByRole("button", { name: /share your session/i })
      );

      expect(onSkip).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard interaction", () => {
    it("calls onSkip when Escape key is pressed", async () => {
      const onSkip = jest.fn();
      render(<PostSessionShare {...defaultProps} onSkip={onSkip} />);

      await userEvent.keyboard("{Escape}");

      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it("does not call onSkip when a non-Escape key is pressed", async () => {
      const onSkip = jest.fn();
      render(<PostSessionShare {...defaultProps} onSkip={onSkip} />);

      await userEvent.keyboard("{Enter}");

      expect(onSkip).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has role='dialog' on the overlay", () => {
      render(<PostSessionShare {...defaultProps} />);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal='true' on the dialog", () => {
      render(<PostSessionShare {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("has a descriptive aria-label on the dialog", () => {
      render(<PostSessionShare {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-label");
      expect(dialog.getAttribute("aria-label")).toContain("Session logged");
    });

    it("star rating container has descriptive aria-label", () => {
      render(<PostSessionShare {...defaultProps} overallRating={4} />);
      expect(screen.getByLabelText("4 out of 5 stars")).toBeInTheDocument();
    });

    it("individual stars have aria-hidden to avoid screen-reader noise", () => {
      render(<PostSessionShare {...defaultProps} overallRating={4} />);
      const starContainer = screen.getByLabelText("4 out of 5 stars");
      const svgs = starContainer.querySelectorAll('svg[aria-hidden="true"]');
      expect(svgs).toHaveLength(5);
    });
  });
});
