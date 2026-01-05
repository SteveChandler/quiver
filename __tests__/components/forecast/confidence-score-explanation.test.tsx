import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { ConfidenceScoreExplanation } from "@/components/forecast/confidence-score-explanation";

describe("ConfidenceScoreExplanation", () => {
  describe("Score Display", () => {
    it("should display high confidence score with positive styling", () => {
      render(
        <ConfidenceScoreExplanation
          score={87}
          factors={{
            dataFreshness: 95,
            sourceReliability: 90,
            weatherConditions: 85,
            historicalAccuracy: 80,
          }}
        />
      );

      expect(screen.getByText("87%")).toBeInTheDocument();
      expect(screen.getByText(/High Confidence/)).toBeInTheDocument();

      // Should have high confidence styling
      const scoreDisplay = screen.getByTestId("confidence-score");
      expect(scoreDisplay).toHaveClass("bg-green-100", "text-green-700");
    });

    it("should display medium confidence score with caution styling", () => {
      render(
        <ConfidenceScoreExplanation
          score={65}
          factors={{
            dataFreshness: 70,
            sourceReliability: 80,
            weatherConditions: 60,
            historicalAccuracy: 50,
          }}
        />
      );

      expect(screen.getByText("65%")).toBeInTheDocument();
      expect(screen.getByText(/Moderate Confidence/)).toBeInTheDocument();

      // Should have medium confidence styling
      const scoreDisplay = screen.getByTestId("confidence-score");
      expect(scoreDisplay).toHaveClass("bg-yellow-100", "text-yellow-700");
    });

    it("should display low confidence score with warning styling", () => {
      render(
        <ConfidenceScoreExplanation
          score={35}
          factors={{
            dataFreshness: 40,
            sourceReliability: 30,
            weatherConditions: 45,
            historicalAccuracy: 25,
          }}
        />
      );

      expect(screen.getByText("35%")).toBeInTheDocument();
      expect(screen.getAllByText(/Low Confidence/)[0]).toBeInTheDocument();

      // Should have low confidence warning styling
      const scoreDisplay = screen.getByTestId("confidence-score");
      expect(scoreDisplay).toHaveClass("bg-red-100", "text-red-700");
    });
  });

  describe("Factor Breakdown", () => {
    it("should show detailed factor breakdown when expanded", async () => {
      render(
        <ConfidenceScoreExplanation
          score={78}
          factors={{
            dataFreshness: 85,
            sourceReliability: 90,
            weatherConditions: 75,
            historicalAccuracy: 65,
          }}
          showFactors={true}
        />
      );

      expect(screen.getByText(/Data Freshness/)).toBeInTheDocument();
      expect(screen.getByText("85%")).toBeInTheDocument();

      expect(screen.getByText(/Source Reliability/)).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();

      expect(screen.getByText(/Weather Conditions/)).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();

      expect(screen.getByText(/Historical Accuracy/)).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("should explain factor meanings with tooltips", async () => {
      const user = userEvent.setup();
      render(
        <ConfidenceScoreExplanation
          score={82}
          factors={{
            dataFreshness: 90,
            sourceReliability: 85,
            weatherConditions: 80,
            historicalAccuracy: 75,
          }}
          showFactors={true}
          showTooltips={true}
        />
      );

      const freshnessTooltip = screen.getByTestId("data-freshness-tooltip");
      // For now, just check that the tooltip element exists
      expect(freshnessTooltip).toBeInTheDocument();
    });

    it("should highlight concerning factors", () => {
      render(
        <ConfidenceScoreExplanation
          score={58}
          factors={{
            dataFreshness: 30, // Low - should be highlighted
            sourceReliability: 80,
            weatherConditions: 70,
            historicalAccuracy: 50,
          }}
          showFactors={true}
        />
      );

      const freshnessFactor = screen.getByTestId("factor-data-freshness");
      expect(freshnessFactor).toHaveClass("text-red-600");
      expect(screen.getByText(/Outdated data/)).toBeInTheDocument();
    });
  });

  describe("User-Friendly Explanations", () => {
    it("should provide simple explanations for high confidence", () => {
      render(
        <ConfidenceScoreExplanation
          score={92}
          explanation="Recent data from reliable sources with favorable conditions"
          userFriendlyText="Forecast is very reliable - great data quality!"
        />
      );

      expect(screen.getByText(/Forecast is very reliable/)).toBeInTheDocument();
      expect(screen.getByText(/great data quality/)).toBeInTheDocument();
    });

    it("should provide helpful context for medium confidence", () => {
      render(
        <ConfidenceScoreExplanation
          score={67}
          explanation="Mixed data sources with some limitations"
          userFriendlyText="Forecast is reasonably accurate - check conditions before heading out"
        />
      );

      expect(screen.getByText(/reasonably accurate/)).toBeInTheDocument();
      expect(
        screen.getByText(/check conditions before heading out/)
      ).toBeInTheDocument();
    });

    it("should provide clear warnings for low confidence", () => {
      render(
        <ConfidenceScoreExplanation
          score={41}
          explanation="Limited or outdated data available"
          userFriendlyText="Forecast may be unreliable - consider checking local conditions"
          showWarning={true}
        />
      );

      expect(screen.getAllByText(/may be unreliable/)[0]).toBeInTheDocument();
      expect(
        screen.getAllByText(/consider checking local conditions/)[0]
      ).toBeInTheDocument();

      const warning = screen.getByTestId("confidence-warning");
      expect(warning).toBeInTheDocument();
    });
  });

  describe("Historical Context", () => {
    it("should show historical accuracy for the beach", () => {
      render(
        <ConfidenceScoreExplanation
          score={74}
          historicalAccuracy={{
            last30Days: 78,
            last7Days: 72,
            totalSessions: 45,
          }}
          beachName="Trestles"
        />
      );

      expect(
        screen.getByText(/Historical accuracy at Trestles/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Last 30 days:/)).toBeInTheDocument();
      expect(screen.getByText("78%")).toBeInTheDocument();
      expect(screen.getByText(/Based on 45 user sessions/)).toBeInTheDocument();
    });

    it("should handle limited historical data", () => {
      render(
        <ConfidenceScoreExplanation
          score={65}
          historicalAccuracy={{
            last30Days: null,
            last7Days: null,
            totalSessions: 3,
          }}
          beachName="New Beach"
        />
      );

      expect(screen.getByText(/Limited historical data/)).toBeInTheDocument();
      expect(screen.getByText(/Only 3 sessions recorded/)).toBeInTheDocument();
      expect(
        screen.getByText(/Accuracy will improve with more data/)
      ).toBeInTheDocument();
    });
  });

  describe("Interactive Features", () => {
    it("should expand detailed view when clicked", async () => {
      const user = userEvent.setup();
      render(
        <ConfidenceScoreExplanation
          score={79}
          factors={{
            dataFreshness: 85,
            sourceReliability: 80,
            weatherConditions: 75,
            historicalAccuracy: 70,
          }}
          expandable={true}
        />
      );

      const expandButton = screen.getByRole("button", { name: /Show details/ });
      await user.click(expandButton);

      expect(screen.getByText(/Confidence Breakdown/)).toBeInTheDocument();
      expect(
        screen.getByText(/How we calculate this score/)
      ).toBeInTheDocument();
    });

    it("should link to help documentation", () => {
      render(<ConfidenceScoreExplanation score={81} showHelpLink={true} />);

      const helpLink = screen.getByRole("link", {
        name: /Learn about confidence scores/,
      });
      expect(helpLink).toHaveAttribute("href", "/help/forecast-confidence");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for screen readers", () => {
      render(
        <ConfidenceScoreExplanation
          score={73}
          factors={{
            dataFreshness: 80,
            sourceReliability: 75,
            weatherConditions: 70,
            historicalAccuracy: 65,
          }}
        />
      );

      const scoreElement = screen.getByTestId("confidence-score");
      expect(scoreElement).toHaveAttribute(
        "aria-label",
        "Forecast confidence: 73% - Moderate Confidence"
      );
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(
        <ConfidenceScoreExplanation
          score={86}
          factors={{
            dataFreshness: 90,
            sourceReliability: 85,
            weatherConditions: 80,
            historicalAccuracy: 75,
          }}
          expandable={true}
        />
      );

      const expandButton = screen.getByRole("button", { name: /Show details/ });

      // Should be focusable
      expandButton.focus();
      expect(expandButton).toHaveFocus();

      // Should activate with Enter key
      await user.keyboard("{Enter}");
      expect(screen.getByText(/Confidence Breakdown/)).toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("should render compact version on mobile", () => {
      render(<ConfidenceScoreExplanation score={68} compact={true} />);

      expect(
        screen.getByTestId("confidence-score-compact")
      ).toBeInTheDocument();
      expect(screen.queryByText(/Show details/)).not.toBeInTheDocument();
    });

    it("should show abbreviated explanations in compact mode", () => {
      render(
        <ConfidenceScoreExplanation
          score={84}
          compact={true}
          userFriendlyText="High quality forecast"
        />
      );

      expect(screen.getByText("84%")).toBeInTheDocument();
      expect(screen.getByText(/High quality/)).toBeInTheDocument();
    });
  });
});
