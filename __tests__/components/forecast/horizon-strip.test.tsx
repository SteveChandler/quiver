import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { HorizonStrip } from "@/components/forecast/horizon-strip";
import { track } from "@/lib/analytics";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";

// Mock dependencies
jest.mock("@/lib/utils", () => ({
  cn: jest.fn((...args: any[]) => args.flat().filter(Boolean).join(" ")),
}));

jest.mock("@/lib/utils/horizon-strip-utils", () => ({
  TIER_COLORS: {
    epic: { bg: "bg-epic", border: "border-epic", text: "text-epic", badge: "badge-epic" },
    good: { bg: "bg-good", border: "border-good", text: "text-good", badge: "badge-good" },
    fair: { bg: "bg-fair", border: "border-fair", text: "text-fair", badge: "badge-fair" },
    rideable: { bg: "bg-rideable", border: "border-rideable", text: "text-rideable", badge: "badge-rideable" },
    meh: { bg: "bg-meh", border: "border-meh", text: "text-meh", badge: "badge-meh" },
  },
  formatWaveRange: jest.fn((min, max) => `${min}-${max}ft`),
  getTierLabel: jest.fn((tier) => tier.charAt(0).toUpperCase() + tier.slice(1)),
}));

jest.mock("@/components/forecast/horizon-strip-skeleton", () => ({
  HorizonStripSkeleton: () => <div data-testid="horizon-strip-skeleton" />,
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Test helpers
function createMockDay(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    fullDate: "2026-02-10",
    dayName: "Mon",
    date: "Feb 10",
    score: 70,
    tier: "good" as const,
    minHeight: 3,
    maxHeight: 5,
    period: 12,
    bestTime: "08:00",
    isToday: false,
    ...overrides,
  };
}

describe("HorizonStrip", () => {
  const mockOnSelectDate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock scrollTo for JSDOM (define first since JSDOM lacks it, then spy for clean restoration)
    if (!Element.prototype.scrollTo) {
      Element.prototype.scrollTo = () => {};
    }
    jest.spyOn(Element.prototype, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Loading State", () => {
    it("renders skeleton when isLoading is true", () => {
      render(
        <HorizonStrip
          days={[]}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
          isLoading={true}
        />
      );

      expect(screen.getByTestId("horizon-strip-skeleton")).toBeInTheDocument();
    });

    it("does not render day cards when loading", () => {
      const days = [createMockDay()];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
          isLoading={true}
        />
      );

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("renders no data message when days array is empty", () => {
      render(
        <HorizonStrip
          days={[]}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("No forecast data available")).toBeInTheDocument();
    });

    it("does not render skeleton or day cards in empty state", () => {
      render(
        <HorizonStrip
          days={[]}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.queryByTestId("horizon-strip-skeleton")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Day Card Rendering", () => {
    it("renders correct number of day buttons", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10", dayName: "Mon", date: "Feb 10" }),
        createMockDay({ fullDate: "2026-02-11", dayName: "Tue", date: "Feb 11" }),
        createMockDay({ fullDate: "2026-02-12", dayName: "Wed", date: "Feb 12" }),
        createMockDay({ fullDate: "2026-02-13", dayName: "Thu", date: "Feb 13" }),
        createMockDay({ fullDate: "2026-02-14", dayName: "Fri", date: "Feb 14" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(5);
    });

    it("displays day name in each card", () => {
      const days = [
        createMockDay({ dayName: "Mon" }),
        createMockDay({ dayName: "Tue" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("Mon")).toBeInTheDocument();
      expect(screen.getByText("Tue")).toBeInTheDocument();
    });

    it("displays wave range using formatWaveRange", () => {
      const { formatWaveRange } = require("@/lib/utils/horizon-strip-utils");
      const days = [createMockDay({ minHeight: 3, maxHeight: 5 })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(formatWaveRange).toHaveBeenCalledWith(3, 5);
      expect(screen.getByText("3-5ft")).toBeInTheDocument();
    });

    it("renders a canonical headline label without re-bucketing it", () => {
      const { formatWaveRange } = require("@/lib/utils/horizon-strip-utils");
      const days = [
        createMockDay({
          minHeight: 1,
          maxHeight: 9,
          headlineLabel: "2-3ft",
        }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("2-3ft")).toBeInTheDocument();
      expect(formatWaveRange).not.toHaveBeenCalled();
    });

    it("displays date in each card", () => {
      const days = [
        createMockDay({ date: "Feb 10" }),
        createMockDay({ date: "Feb 11" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("Feb 10")).toBeInTheDocument();
      expect(screen.getByText("Feb 11")).toBeInTheDocument();
    });

    it("displays period when not null", () => {
      const days = [createMockDay({ period: 12 })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("12s")).toBeInTheDocument();
    });

    it("does not display period when null", () => {
      const days = [createMockDay({ period: null })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.queryByText(/\ds$/)).not.toBeInTheDocument();
    });
  });

  describe("Selected State", () => {
    it("marks selected day with aria-pressed='true'", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
      expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    });

    it("only one day has aria-pressed='true' at a time", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
        createMockDay({ fullDate: "2026-02-12" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-11"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      const pressedButtons = buttons.filter(
        (btn) => btn.getAttribute("aria-pressed") === "true"
      );

      expect(pressedButtons).toHaveLength(1);
      expect(pressedButtons[0]).toBe(buttons[1]);
    });

    it("applies selected styling to matching day", () => {
      const days = [createMockDay({ fullDate: "2026-02-10" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const button = screen.getByRole("button");
      expect(button.className).toMatch(/ring-2/);
    });
  });

  describe("User Interactions", () => {
    it("calls onSelectDate with fullDate when day is clicked", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);

      expect(mockOnSelectDate).toHaveBeenCalledWith("2026-02-11");
      expect(mockOnSelectDate).toHaveBeenCalledTimes(1);
    });

    it("tracks analytics event when beachSlug is provided", () => {
      const days = [createMockDay({
        fullDate: "2026-02-10",
        tier: "good",
        score: 70,
        isToday: false
      })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
          beachSlug="blacks"
        />
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(track).toHaveBeenCalledWith("horizon_strip_day_selected", {
        beach_slug: "blacks",
        selected_date: "2026-02-10",
        is_today: false,
        tier: "good",
        score: 70,
      });
    });

    it("does not track analytics when beachSlug is not provided", () => {
      const days = [createMockDay({ fullDate: "2026-02-10" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(track).not.toHaveBeenCalled();
    });

    it("clicking already selected day still calls onSelectDate", () => {
      const days = [createMockDay({ fullDate: "2026-02-10" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockOnSelectDate).toHaveBeenCalledWith("2026-02-10");
    });
  });

  describe("Today Highlight", () => {
    it("applies underline decoration to today's day name", () => {
      const days = [
        createMockDay({ isToday: true, dayName: "Mon" }),
        createMockDay({ isToday: false, dayName: "Tue" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const mondayText = screen.getByText("Mon");
      expect(mondayText.className).toMatch(/underline/);

      const tuesdayText = screen.getByText("Tue");
      expect(tuesdayText.className).not.toMatch(/underline/);
    });

    it("does not apply underline when isToday is false", () => {
      const days = [createMockDay({ isToday: false, dayName: "Wed" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const dayName = screen.getByText("Wed");
      expect(dayName.className).not.toMatch(/underline/);
    });
  });

  describe("Tier Badges", () => {
    it("renders badge for 'epic' tier with star symbol", () => {
      const days = [createMockDay({ tier: "epic" })];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      // Badge is a span with aria-hidden inside the button
      const badge = container.querySelector('span[aria-hidden="true"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("★");
    });

    it("renders badge for 'good' tier with circle symbol", () => {
      const days = [createMockDay({ tier: "good" })];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const badge = container.querySelector('span[aria-hidden="true"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("●");
    });

    it("renders badge for 'fair' tier with open circle symbol", () => {
      const days = [createMockDay({ tier: "fair" })];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const badge = container.querySelector('span[aria-hidden="true"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("○");
    });

    it("does not render badge for 'meh' tier", () => {
      const days = [createMockDay({ tier: "meh" })];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      // TierBadge returns null for meh, so no aria-hidden span should exist
      // (other than the spacer divs at the end)
      const badges = container.querySelectorAll('button span[aria-hidden="true"]');
      expect(badges.length).toBe(0);
    });

    it("renders different badges for different tiers", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10", tier: "epic" }),
        createMockDay({ fullDate: "2026-02-11", tier: "good" }),
        createMockDay({ fullDate: "2026-02-12", tier: "fair" }),
        createMockDay({ fullDate: "2026-02-13", tier: "meh" }),
      ];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      // Only 3 badges: epic, good, fair (meh returns null)
      const badges = container.querySelectorAll('button span[aria-hidden="true"]');
      expect(badges.length).toBe(3);
    });
  });

  describe("Right Fade Indicator", () => {
    it("renders fade indicator when days count exceeds 4", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
        createMockDay({ fullDate: "2026-02-12" }),
        createMockDay({ fullDate: "2026-02-13" }),
        createMockDay({ fullDate: "2026-02-14" }),
      ];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      // Look for fade indicator div (gradient from white to transparent)
      // Component uses: bg-gradient-to-l from-white to-transparent
      const fadeElements = Array.from(container.querySelectorAll('div[aria-hidden="true"]'));
      const fadeIndicator = fadeElements.find(el =>
        el.className.includes('bg-gradient-to-l')
      );
      expect(fadeIndicator).toBeInTheDocument();
    });

    it("does not render fade indicator when days count is 4 or less", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
        createMockDay({ fullDate: "2026-02-12" }),
        createMockDay({ fullDate: "2026-02-13" }),
      ];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const fadeElements = Array.from(container.querySelectorAll('div[aria-hidden="true"]'));
      const fadeIndicator = fadeElements.find(el =>
        el.className.includes('bg-gradient-to-l')
      );
      expect(fadeIndicator).toBeUndefined();
    });

    it("does not render fade indicator when only 1 day present", () => {
      const days = [createMockDay()];

      const { container } = render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const fadeElements = Array.from(container.querySelectorAll('div[aria-hidden="true"]'));
      const fadeIndicator = fadeElements.find(el =>
        el.className.includes('bg-gradient-to-l')
      );
      expect(fadeIndicator).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles multiple rapid clicks", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[1]);

      expect(mockOnSelectDate).toHaveBeenCalledTimes(3);
      expect(mockOnSelectDate).toHaveBeenCalledWith("2026-02-11");
    });

    it("handles selectedDate that does not match any day", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-99"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-pressed", "false");
      });
    });

    it("handles all tiers in single render", () => {
      const days = [
        createMockDay({ tier: "epic" }),
        createMockDay({ tier: "good" }),
        createMockDay({ tier: "fair" }),
        createMockDay({ tier: "rideable" }),
        createMockDay({ tier: "meh" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(5);
    });

    it("handles zero wave height", () => {
      const { formatWaveRange } = require("@/lib/utils/horizon-strip-utils");
      const days = [createMockDay({ minHeight: 0, maxHeight: 0 })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(formatWaveRange).toHaveBeenCalledWith(0, 0);
    });

    it("handles very long day names gracefully", () => {
      const days = [createMockDay({ dayName: "Wednesday" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      expect(screen.getByText("Wednesday")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("all day buttons have aria-pressed attribute", () => {
      const days = [
        createMockDay({ fullDate: "2026-02-10" }),
        createMockDay({ fullDate: "2026-02-11" }),
        createMockDay({ fullDate: "2026-02-12" }),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-11"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute("aria-pressed");
      });
    });

    it("buttons are keyboard accessible", () => {
      const days = [createMockDay({ fullDate: "2026-02-10" })];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const button = screen.getByRole("button");
      expect(button).toBeInstanceOf(HTMLButtonElement);
    });

    it("renders proper semantic button elements", () => {
      const days = [
        createMockDay(),
        createMockDay(),
      ];

      render(
        <HorizonStrip
          days={days}
          selectedDate="2026-02-10"
          onSelectDate={mockOnSelectDate}
        />
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((btn) => {
        expect(btn.tagName).toBe("BUTTON");
      });
    });
  });
});
