/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TodaySurfCall } from "@/components/beach-detail/zine/today-surf-call";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";

describe("TodaySurfCall", () => {
  it("does not invent a fallback verdict when no authorized call is available", () => {
    const { container } = render(
      <TodaySurfCall beach={createMockBeach({ name: "Seaside Reef" })} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("labels the public call as tomorrow when the selected forecast rolls over", () => {
    render(
      <TodaySurfCall
        beach={createMockBeach({ name: "Oceanside Harbor" })}
        isTomorrow
        surfCallReport={{
          verdict: "MAYBE",
          bestWindowStart: null,
          bestWindowEnd: null,
          whySentence: "Use the tomorrow window.",
          updatedAt: "2026-05-21T18:32:00.000Z",
        } as any}
      />,
    );

    expect(screen.getByRole("region", { name: "Tomorrow's surf call" })).toBeInTheDocument();
    expect(screen.getByText("Tomorrow's Surf Call")).toBeInTheDocument();
  });

  it("uses the Go surf family for YES when no window exists", () => {
    render(
      <TodaySurfCall
        beach={createMockBeach({ name: "Seaside Reef" })}
        surfCallReport={{
          verdict: "YES",
          bestWindowStart: null,
          bestWindowEnd: null,
          waveHeight: "2-3 ft",
          windCompass: "W",
          windSpeed: "6 mph",
          windType: "offshore",
          tidePhase: "rising",
          tideHeight: "3.1 ft",
          whySentence: "Clean and playful.",
          updatedAt: "2026-04-30T12:30:00.000Z",
        } as any}
      />,
    );

    expect(screen.getByText("GO SURF!")).toBeInTheDocument();
    expect(screen.queryByText("PADDLE OUT")).not.toBeInTheDocument();
  });

  it("keeps BEST AT window copy for YES and uses the contrast-checked dark teal", () => {
    render(
      <TodaySurfCall
        beach={createMockBeach({ name: "Marine Street Beach" })}
        beachTimezone="America/Los_Angeles"
        surfCallReport={{
          verdict: "YES",
          bestWindowStart: "2026-05-21T14:00:00.000Z",
          bestWindowEnd: "2026-05-21T16:00:00.000Z",
          waveHeight: "2-3 ft",
          windCompass: "SW",
          windSpeed: "8 mph",
          windType: "offshore",
          tidePhase: "rising",
          tideHeight: "0.7 ft",
          whySentence: "Clean and playful.",
          updatedAt: "2026-05-21T18:32:00.000Z",
        } as any}
      />,
    );

    expect(screen.getByText(/BEST AT 7:00 AM/i)).toBeInTheDocument();
    expect(screen.getByText("YES")).toHaveStyle({ color: "#006B5F" });
  });
});
