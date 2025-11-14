import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";

describe("PersonalizedBadge", () => {
  describe("Rendering States", () => {
    it("should render when personalized is true", () => {
      render(<PersonalizedBadge personalized={true} />);

      expect(
        screen.getByTestId("personalized-badge-container")
      ).toBeInTheDocument();
      expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
      expect(screen.getByText("Personalized for you")).toBeInTheDocument();
    });

    it("should not render when personalized is false", () => {
      render(<PersonalizedBadge personalized={false} />);

      expect(
        screen.queryByTestId("personalized-badge-container")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("personalized-badge")
      ).not.toBeInTheDocument();
    });

    it("should render with breakdown data", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 10,
          }}
        />
      );

      expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
      expect(screen.getByText("Personalized for you")).toBeInTheDocument();
    });

    it("should render without breakdown data", () => {
      render(<PersonalizedBadge personalized={true} />);

      expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
      // No tooltip content should render when breakdown is undefined
    });

    it("should render with affinity data", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 5,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      expect(screen.getByTestId("personalized-badge")).toBeInTheDocument();
      expect(screen.getByTestId("affinity-badge")).toBeInTheDocument();
      expect(screen.getByText(/You've surfed here 5×/)).toBeInTheDocument();
    });
  });

  describe("Score Breakdown Tooltip", () => {
    it("should display all breakdown values in tooltip", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 10,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      // Wait for tooltip to appear
      const tooltip = await screen.findByTestId("personalized-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Check all breakdown items are displayed (use getAllByTestId for tooltips)
      expect(
        screen.getAllByTestId("breakdown-item-base-score")[0]
      ).toBeInTheDocument();
      expect(
        screen.getAllByTestId("breakdown-item-your-preferences")[0]
      ).toBeInTheDocument();
      expect(
        screen.getAllByTestId("breakdown-item-learned-behavior")[0]
      ).toBeInTheDocument();
      expect(
        screen.getAllByTestId("breakdown-item-beach-affinity")[0]
      ).toBeInTheDocument();
    });

    it("should hide zero-value items from tooltip", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75,
            onboardingPrefs: 0,
            learnedPrefs: 5,
            affinity: 0,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      // Wait for tooltip to appear
      const tooltip = await screen.findByTestId("personalized-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Check only non-zero items are displayed
      expect(
        screen.getAllByTestId("breakdown-item-base-score")[0]
      ).toBeInTheDocument();
      expect(
        screen.queryAllByTestId("breakdown-item-your-preferences")
      ).toHaveLength(0);
      expect(
        screen.getAllByTestId("breakdown-item-learned-behavior")[0]
      ).toBeInTheDocument();
      expect(
        screen.queryAllByTestId("breakdown-item-beach-affinity")
      ).toHaveLength(0);
    });

    it("should format scores correctly (whole numbers)", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75.7,
            onboardingPrefs: 10.3,
            learnedPrefs: 5.5,
            affinity: 10.9,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      const tooltip = await screen.findByTestId("personalized-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Check that values are rounded to whole numbers
      expect(screen.getAllByText("+76")[0]).toBeInTheDocument(); // base: 75.7
      expect(screen.getAllByText("+10")[0]).toBeInTheDocument(); // onboardingPrefs: 10.3
      expect(screen.getAllByText("+6")[0]).toBeInTheDocument(); // learnedPrefs: 5.5
      expect(screen.getAllByText("+11")[0]).toBeInTheDocument(); // affinity: 10.9
    });

    it("should show proper labels in tooltip", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75,
            onboardingPrefs: 10,
            learnedPrefs: 5,
            affinity: 10,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      const tooltip = await screen.findByTestId("personalized-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Check labels are correct (use getAllByText for tooltip content)
      expect(screen.getAllByText("Base Score:")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Your Preferences:")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Learned Behavior:")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Beach Affinity:")[0]).toBeInTheDocument();
    });
  });

  describe("Affinity Badge", () => {
    it("should show session count correctly", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 15,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      expect(screen.getByTestId("affinity-badge")).toBeInTheDocument();
      expect(screen.getByText(/You've surfed here 15×/)).toBeInTheDocument();
    });

    it("should handle singular form (1 session)", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 1,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      const affinityBadge = screen.getByTestId("affinity-badge");
      expect(affinityBadge).toHaveAttribute(
        "aria-label",
        "You've surfed here 1 time"
      );
    });

    it("should handle plural form (multiple sessions)", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 5,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      const affinityBadge = screen.getByTestId("affinity-badge");
      expect(affinityBadge).toHaveAttribute(
        "aria-label",
        "You've surfed here 5 times"
      );
    });

    it("should be hidden when sessionCount is 0", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 0,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      expect(
        screen.queryByTestId("affinity-badge")
      ).not.toBeInTheDocument();
    });

    it("should be hidden when affinityData is undefined", () => {
      render(<PersonalizedBadge personalized={true} />);

      expect(
        screen.queryByTestId("affinity-badge")
      ).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA label on personalized badge", () => {
      render(<PersonalizedBadge personalized={true} />);

      const badge = screen.getByTestId("personalized-badge");
      expect(badge).toHaveAttribute(
        "aria-label",
        "This recommendation is personalized for you"
      );
    });

    it("should have proper ARIA label on affinity badge", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 15,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      const affinityBadge = screen.getByTestId("affinity-badge");
      expect(affinityBadge).toHaveAttribute(
        "aria-label",
        "You've surfed here 15 times"
      );
    });

    it("should mark decorative icons as aria-hidden", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 5,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      // Sparkles icon on personalized badge
      const sparklesIcon = screen
        .getByTestId("personalized-badge")
        .querySelector('svg');
      expect(sparklesIcon).toHaveAttribute("aria-hidden", "true");

      // Emoji on affinity badge
      const affinityBadge = screen.getByTestId("affinity-badge");
      const emoji = affinityBadge.querySelector('span[aria-hidden="true"]');
      expect(emoji).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle all breakdown values being 0", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 0,
            onboardingPrefs: 0,
            learnedPrefs: 0,
            affinity: 0,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      // Tooltip should not render when all values are 0
      expect(
        screen.queryByTestId("personalized-tooltip")
      ).not.toBeInTheDocument();
    });

    it("should handle negative breakdown values", async () => {
      const user = userEvent.setup();

      render(
        <PersonalizedBadge
          personalized={true}
          breakdown={{
            base: 75,
            onboardingPrefs: -5,
            learnedPrefs: 10,
            affinity: -3,
          }}
        />
      );

      const badge = screen.getByTestId("personalized-badge");
      await user.hover(badge);

      const tooltip = await screen.findByTestId("personalized-tooltip");
      expect(tooltip).toBeInTheDocument();

      // Only positive values should be shown (filter removes negative values)
      expect(
        screen.getAllByTestId("breakdown-item-base-score")[0]
      ).toBeInTheDocument();
      expect(
        screen.queryAllByTestId("breakdown-item-your-preferences")
      ).toHaveLength(0); // Negative value
      expect(
        screen.getAllByTestId("breakdown-item-learned-behavior")[0]
      ).toBeInTheDocument();
      expect(
        screen.queryAllByTestId("breakdown-item-beach-affinity")
      ).toHaveLength(0); // Negative value
    });

    it("should handle very large session counts (999+)", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 1234,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      expect(
        screen.getByText(/You've surfed here 1234×/)
      ).toBeInTheDocument();
    });

    it("should merge custom className correctly", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          className="mt-4 custom-class"
        />
      );

      const container = screen.getByTestId("personalized-badge-container");
      expect(container).toHaveClass("mt-4", "custom-class");
    });
  });

  describe("Visual Styling", () => {
    it("should use secondary variant for personalized badge", () => {
      render(<PersonalizedBadge personalized={true} />);

      const badge = screen.getByTestId("personalized-badge");
      // Badge component with variant="secondary" should have these classes
      expect(badge).toHaveClass("bg-secondary");
    });

    it("should use outline variant for affinity badge", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 5,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      const affinityBadge = screen.getByTestId("affinity-badge");
      // Badge component with variant="outline" has text-foreground class
      expect(affinityBadge).toHaveClass("text-foreground");
    });

    it("should have cursor-help on personalized badge", () => {
      render(<PersonalizedBadge personalized={true} />);

      const badge = screen.getByTestId("personalized-badge");
      expect(badge).toHaveClass("cursor-help");
    });

    it("should layout badges with flex gap-2", () => {
      render(
        <PersonalizedBadge
          personalized={true}
          affinityData={{
            sessionCount: 5,
            lastSurfed: new Date("2024-01-15"),
          }}
        />
      );

      const container = screen.getByTestId("personalized-badge-container");
      const badgeWrapper = container.querySelector(".flex");
      expect(badgeWrapper).toHaveClass("gap-2");
    });
  });
});
