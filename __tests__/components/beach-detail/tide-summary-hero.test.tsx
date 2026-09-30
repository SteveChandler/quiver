import React from "react";
import { render, screen } from "@testing-library/react";
import { TideSummaryHero } from "@/components/beach-detail/tide-summary-hero";
import type { TideMetaData } from "@/lib/seo/tide-meta-data";

// 11:00 PM on the 27th and 5:00 AM on the 28th, Pacific daylight time.
const ELEVEN_PM_TONIGHT = "2026-09-28T06:00:00.000Z";
const FIVE_AM_TOMORROW = "2026-09-28T12:00:00.000Z";

function tideData(overrides: Partial<TideMetaData>): TideMetaData {
  return {
    nextHighTime: null,
    nextLowTime: null,
    nextHighHeight: null,
    nextLowHeight: null,
    nextHighAt: null,
    nextLowAt: null,
    ...overrides,
  };
}

describe("TideSummaryHero tide status", () => {
  it("reads rising when the next high is tonight and the next low is after midnight", () => {
    render(
      <TideSummaryHero
        beachName="Tourmaline"
        tideData={tideData({
          nextHighTime: "11:00 PM",
          nextHighAt: ELEVEN_PM_TONIGHT,
          nextLowTime: "5:00 AM",
          nextLowAt: FIVE_AM_TOMORROW,
        })}
      />,
    );

    expect(screen.getByLabelText("Tide is currently Rising")).toBeInTheDocument();
  });

  it("reads falling when the next low is tonight and the next high is after midnight", () => {
    render(
      <TideSummaryHero
        beachName="Tourmaline"
        tideData={tideData({
          nextLowTime: "11:00 PM",
          nextLowAt: ELEVEN_PM_TONIGHT,
          nextHighTime: "5:00 AM",
          nextHighAt: FIVE_AM_TOMORROW,
        })}
      />,
    );

    expect(screen.getByLabelText("Tide is currently Falling")).toBeInTheDocument();
  });

  it("shows no status when the event timestamps are missing", () => {
    // Display strings alone carry no date, so they cannot order the two events.
    render(
      <TideSummaryHero
        beachName="Tourmaline"
        tideData={tideData({ nextHighTime: "11:00 PM", nextLowTime: "5:00 AM" })}
      />,
    );

    expect(screen.getByText("11:00 PM")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Tide is currently/)).not.toBeInTheDocument();
  });
});
