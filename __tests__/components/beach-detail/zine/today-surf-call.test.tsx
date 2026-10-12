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

  it("uses the plain worth-a-surf call for YES when no window exists", () => {
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

    expect(screen.getByText("Worth a surf")).toBeInTheDocument();
    expect(screen.queryByText("WORTH A SURF")).not.toBeInTheDocument();
    expect(screen.queryByText("PADDLE OUT")).not.toBeInTheDocument();
  });

  it("keeps BEST AT window copy for YES and sets the call in native's teal ink", () => {
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
    expect(screen.getByText("GOOD")).toHaveStyle({ color: "#06765F" });
    expect(screen.getByText("Worth a surf")).toBeInTheDocument();
  });

  it("never shows the internal verdict as copy", () => {
    render(
      <TodaySurfCall
        beach={createMockBeach({ name: "Seaside Reef" })}
        surfCallReport={{
          verdict: "MAYBE",
          score: 58,
          bestWindowStart: null,
          bestWindowEnd: null,
          whySentence: "Soft but rideable.",
          updatedAt: "2026-05-21T18:32:00.000Z",
        } as any}
      />,
    );

    expect(screen.getByText("FAIR")).toHaveStyle({ color: "#8A5E00" });
    expect(screen.getByText("Worth a look")).toBeInTheDocument();
    expect(screen.queryByText("MAYBE")).not.toBeInTheDocument();
  });

  it("calls a skip day MEH in full ink", () => {
    render(
      <TodaySurfCall
        beach={createMockBeach({ name: "Seaside Reef" })}
        surfCallReport={{
          verdict: "NO",
          score: 22,
          bestWindowStart: null,
          bestWindowEnd: null,
          whySentence: "Flat.",
          updatedAt: "2026-05-21T18:32:00.000Z",
        } as any}
      />,
    );

    expect(screen.getByText("MEH")).toHaveStyle({ color: "#11100D" });
    expect(screen.getByText("Skip it")).toBeInTheDocument();
    expect(screen.queryByText("NO")).not.toBeInTheDocument();
  });
});
