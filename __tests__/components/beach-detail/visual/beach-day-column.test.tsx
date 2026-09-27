import { render, screen } from "@testing-library/react";
import { BeachDayColumn } from "@/components/beach-detail/visual/beach-day-column";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";

const mockSun = jest.fn();
jest.mock("@/hooks/use-sun-times", () => ({ useSunTimes: (...args: unknown[]) => mockSun(...args) }));

const BASE = {
  beachId: "b1",
  timezone: "America/Los_Angeles",
  localDate: "2026-09-27",
  waterTemp: { tempF: 73, wetsuitRec: "Boardshorts" },
  tide: { nextLowTime: "3:10 PM", nextLowHeight: 1.1, nextHighTime: "9:52 PM", nextHighHeight: 5.1 },
  waterQuality: null,
  links: { waterTemp: "/ca/san-diego/tourmaline/water-temp", tides: "/ca/san-diego/tourmaline/tides" },
};

beforeEach(() => {
  mockSun.mockReturnValue({ sunrise: new Date("2026-09-27T13:41:00Z"), sunset: new Date("2026-09-28T01:42:00Z") });
});

describe("BeachDayColumn", () => {
  it("answers the beach day: water, tides, daylight", () => {
    render(<BeachDayColumn {...BASE} />);
    const col = screen.getByTestId("beach-day-column");
    expect(col).toHaveTextContent("73°F");
    expect(col).toHaveTextContent("Boardshorts");
    expect(col).toHaveTextContent("3:10 PM");
    expect(col).toHaveTextContent("9:52 PM");
    expect(col).toHaveTextContent("6:41 AM");
    expect(col).toHaveTextContent("6:42 PM");
    expect(screen.getByRole("link", { name: /water temp/i })).toHaveAttribute("href", BASE.links.waterTemp);
    expect(screen.getByRole("link", { name: /tide chart/i })).toHaveAttribute("href", BASE.links.tides);
  });

  it("never says the water is clean, even for a stored 'good' sample", () => {
    const { rerender } = render(<BeachDayColumn {...BASE} waterQuality={{ status: "unknown" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).not.toHaveTextContent(/clean|clear|safe|good/i);
    rerender(<BeachDayColumn {...BASE} waterQuality={{ status: "good" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).not.toHaveTextContent(/clean|clear|safe|good|water quality/i);
  });

  it("shows an advisory when there is one", () => {
    render(<BeachDayColumn {...BASE} waterQuality={{ status: "advisory" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent(/advisory/i);
  });

  it("omits what it doesn't know instead of printing blanks", () => {
    mockSun.mockReturnValue({ sunrise: null, sunset: null });
    render(<BeachDayColumn {...BASE} waterTemp={null} tide={null} links={{ waterTemp: null, tides: null }} />);
    const col = screen.getByTestId("beach-day-column");
    expect(col.textContent).not.toMatch(/null|NaN|undefined|°F/);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
