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
  tide: { nextLowTime: "4:00 PM", nextLowHeight: 1.1, nextHighTime: "3:00 PM", nextHighHeight: 5.1, nextInteriorLowTime: "3:10 PM", nextInteriorLowAt: "2026-09-27T22:10:00Z", nextInteriorHighTime: "9:52 PM" },
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

  it("shows qualified times for tomorrow's turns", () => {
    render(<BeachDayColumn {...BASE} tide={{ ...BASE.tide, nextInteriorLowTime: "Tomorrow 4:00 AM", nextInteriorHighTime: "Tomorrow 10:00 AM" }} />);
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent("Tomorrow 4:00 AM");
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent("High Tomorrow 10:00 AM");
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

  it("shows a known high tide when there is no low tide", () => {
    render(
      <BeachDayColumn
        {...BASE}
        tide={{ nextLowTime: null, nextLowHeight: null, nextHighTime: "3:00 PM", nextHighHeight: 5.1, nextInteriorLowTime: null, nextInteriorLowAt: null, nextInteriorHighTime: "9:52 PM" }}
      />
    );
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent("Next high tide");
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent("9:52 PM");
    expect(screen.getByRole("link", { name: /tide chart/i })).toHaveAttribute("href", BASE.links.tides);
  });

  it("shows water-quality closure as 'Closed', distinct from advisory", () => {
    render(<BeachDayColumn {...BASE} waterQuality={{ status: "closure" } as WaterQuality} />);
    expect(screen.getByTestId("beach-day-column")).toHaveTextContent("Closed");
    expect(screen.getByTestId("beach-day-column")).not.toHaveTextContent(/advisory/i);
  });
});
