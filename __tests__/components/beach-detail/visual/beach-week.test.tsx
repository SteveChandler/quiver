import { render, screen, within } from "@testing-library/react";
import { BeachWeek } from "@/components/beach-detail/visual/beach-week";
import { swellGlyphGeometry } from "@/components/beach-detail/visual/swell-glyph";
import type { BeachWeekDay } from "@/lib/utils/beach-week";

const TZ = "America/Los_Angeles";

function day(overrides: Partial<BeachWeekDay>): BeachWeekDay {
  return {
    fullDate: "2026-09-27", dayName: "Sun", isToday: false, tier: "fair", minHeight: 2, maxHeight: 3,
    bestAt: "2026-09-27T14:00:00.000Z", swell: { directionDeg: 225, periodS: 11, heightFt: 1.8 },
    lowTide: { at: "2026-09-27T22:10:00.000Z", heightFt: 1.1 }, early: false,
    ...overrides,
  };
}

describe("swellGlyphGeometry", () => {
  it("spaces long-period swell wider, with fewer lines", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 16, heightFt: 3 }).lines).toBe(2);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 3 }).lines).toBe(3);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 7, heightFt: 3 }).lines).toBe(4);
  });

  it("draws bigger swell heavier, within bounds", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 0.5 }).strokeWidth).toBe(1.4);
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 12 }).strokeWidth).toBe(4);
  });

  it("tilts with the direction the swell comes from", () => {
    expect(swellGlyphGeometry({ directionDeg: 270, periodS: 11, heightFt: 2 }).rotationDeg).toBe(0);
    expect(swellGlyphGeometry({ directionDeg: 225, periodS: 11, heightFt: 2 }).rotationDeg).toBe(-45);
  });

  it("wraps direction around 0° so nearby angles tilt the same way", () => {
    expect(swellGlyphGeometry({ directionDeg: 350, periodS: 11, heightFt: 2 }).rotationDeg).toBe(80);
    expect(swellGlyphGeometry({ directionDeg: 10, periodS: 11, heightFt: 2 }).rotationDeg).toBe(80);
    expect(swellGlyphGeometry({ directionDeg: 180, periodS: 11, heightFt: 2 }).rotationDeg).toBe(-80);
  });
});

describe("BeachWeek", () => {
  it("labels each day with its tier word, size and low tide", () => {
    render(<BeachWeek days={[day({ isToday: true, dayName: "Sat" })]} timezone={TZ} />);
    const card = within(screen.getByTestId("beach-week")).getAllByRole("listitem")[0];
    expect(card).toHaveTextContent("Today");
    expect(card).toHaveTextContent("FAIR");
    expect(card).toHaveTextContent("ft");
    expect(card).toHaveTextContent("Low 3:10pm");
  });

  it("marks early reads and omits what a day doesn't have", () => {
    render(<BeachWeek days={[day({ early: true, swell: null, lowTide: null, bestAt: null })]} timezone={TZ} />);
    const card = within(screen.getByTestId("beach-week")).getAllByRole("listitem")[0];
    expect(card).toHaveTextContent("Early");
    expect(card).not.toHaveTextContent("Low");
    expect(card.textContent).not.toMatch(/null|NaN|undefined/);
    expect(card.querySelector("svg")).toBeNull();
  });

  it("renders nothing without days", () => {
    const { container } = render(<BeachWeek days={[]} timezone={TZ} />);
    expect(container).toBeEmptyDOMElement();
  });
});
