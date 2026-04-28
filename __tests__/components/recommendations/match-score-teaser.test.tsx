/**
 * MatchScoreTeaser Component Tests
 *
 * Tests for the teaser badge shown to non-authenticated users.
 * Verifies:
 * - Badge text and icon render correctly
 * - Auth modal opens on click with correct props
 * - contextMessage is passed through correctly
 * - className prop is applied
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { MatchScoreTeaser } from "@/components/recommendations/match-score-teaser";

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div
        data-testid="auth-modal"
        data-source={props.source}
        data-context-title={props.contextMessage?.title}
        data-context-description={props.contextMessage?.description}
        data-mode={props.mode}
        data-return-to={props.returnTo}
      />
    ) : null,
}));

const mockTrackSignupCtaView = jest.fn();
const mockTrackSignupCtaClick = jest.fn();
jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaView: (...args: any[]) => mockTrackSignupCtaView(...args),
  trackSignupCtaClick: (...args: any[]) => mockTrackSignupCtaClick(...args),
}));

jest.mock("next/navigation", () => ({ usePathname: () => "/ca/san-diego/blacks" }));

describe("MatchScoreTeaser", () => {
  const defaultProps = {
    beachId: "beach-123",
    beachName: "Blacks Beach",
  };

  beforeEach(() => {
    mockTrackSignupCtaView.mockClear();
    mockTrackSignupCtaClick.mockClear();
  });

  describe("renders Match: ??? badge with Sparkles icon", () => {
    it("shows the Match: ??? text", () => {
      render(<MatchScoreTeaser {...defaultProps} />);
      expect(screen.getByText("Match: ???")).toBeInTheDocument();
    });

    it("renders a Sparkles SVG icon", () => {
      const { container } = render(<MatchScoreTeaser {...defaultProps} />);
      // Sparkles icon renders as an SVG
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe("opens auth modal when clicked", () => {
    it("does not show auth modal before clicking", () => {
      render(<MatchScoreTeaser {...defaultProps} />);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("opens auth modal after clicking the badge", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      const badge = screen.getByText("Match: ???").closest("[data-testid='match-score-teaser']") ??
        screen.getByTestId("match-score-teaser");
      await user.click(badge);

      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    });

    it("passes correct source to auth modal", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      await user.click(screen.getByTestId("match-score-teaser"));

      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-source",
        "match-score-teaser"
      );
    });

    it("passes mode='signup' to auth modal", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      await user.click(screen.getByTestId("match-score-teaser"));

      expect(screen.getByTestId("auth-modal")).toHaveAttribute("data-mode", "signup");
    });

    it("passes returnTo from usePathname to auth modal", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      await user.click(screen.getByTestId("match-score-teaser"));

      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-return-to",
        "/ca/san-diego/blacks"
      );
    });
  });

  describe("passes correct contextMessage to auth modal", () => {
    it("passes the correct title via contextMessage", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      await user.click(screen.getByTestId("match-score-teaser"));

      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-context-title",
        "See Your Forecast"
      );
    });

    it("passes beach name in contextMessage description", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} />);

      await user.click(screen.getByTestId("match-score-teaser"));

      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-context-description",
        "See conditions at Blacks Beach explained clearly for your level"
      );
    });
  });

  describe("applies className prop", () => {
    it("applies a custom className to the wrapper element", () => {
      render(<MatchScoreTeaser {...defaultProps} className="my-custom-class" />);
      const wrapper = screen.getByTestId("match-score-teaser");
      expect(wrapper.className).toContain("my-custom-class");
    });
  });

  describe("tracks cta_copy_variant for post-reinstatement CTR comparison", () => {
    it("passes cta_copy_variant=match_score_v2_reinstated on view (badge variant)", () => {
      render(<MatchScoreTeaser {...defaultProps} />);
      expect(mockTrackSignupCtaView).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "match-score-teaser-beach-123",
          surface: "beach-detail",
          variant: "badge",
          cta_copy_variant: "match_score_v2_reinstated",
          beach_id: "beach-123",
        })
      );
    });

    it("passes cta_copy_variant=match_score_v2_reinstated on view (card variant)", () => {
      render(<MatchScoreTeaser {...defaultProps} variant="card" />);
      expect(mockTrackSignupCtaView).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "card",
          cta_copy_variant: "match_score_v2_reinstated",
        })
      );
    });

    it("passes cta_copy_variant=match_score_v2_reinstated on click", async () => {
      const user = userEvent.setup();
      render(<MatchScoreTeaser {...defaultProps} variant="card" />);

      await user.click(screen.getByTestId("match-score-teaser-card"));

      expect(mockTrackSignupCtaClick).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "match-score-teaser-beach-123",
          surface: "beach-detail",
          variant: "card",
          cta_copy_variant: "match_score_v2_reinstated",
          beach_id: "beach-123",
        })
      );
    });
  });
});
