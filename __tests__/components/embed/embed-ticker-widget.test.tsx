import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmbedTickerWidget } from "@/app/embed/ticker/[slug]/embed-ticker-widget";
import type { ConditionsData } from "@/types/conditions";

jest.mock("@/hooks/use-embed-impression", () => ({
  useEmbedImpression: jest.fn(),
}));

import { useEmbedImpression } from "@/hooks/use-embed-impression";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const BEACH_URL = "https://quiversurf.app/ca/san-diego/blacks";
const BEACH_NAME = "Blacks Beach";
const SLUG = "blacks-beach";

const ALL_DATA: ConditionsData = {
  waveHeight: "4",
  wavePeriod: "12",
  waveDirection: "W",
  windSpeed: "10",
  windDirection: "NW",
  waterTemp: "62",
  tideStatus: "Rising",
  tideHeight: "2.1",
};

function renderWidget(
  data: ConditionsData,
  theme: "light" | "dark" = "light",
  slug = SLUG
) {
  return render(
    <EmbedTickerWidget
      beachName={BEACH_NAME}
      beachUrl={BEACH_URL}
      slug={slug}
      data={data}
      theme={theme}
    />
  );
}

// ---------------------------------------------------------------------------
// 1. Renders all 5 data cards when all data is present
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - all data cards", () => {
  it("renders the Waves card label when waveHeight is provided", () => {
    renderWidget(ALL_DATA);
    // The static fallback (aria-hidden=false) carries the visible text
    expect(screen.getAllByText("Waves").length).toBeGreaterThan(0);
  });

  it("renders the Swell card label when wavePeriod is provided", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Swell").length).toBeGreaterThan(0);
  });

  it("renders the Wind card label when windSpeed is provided", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Wind").length).toBeGreaterThan(0);
  });

  it("renders the Water card label when waterTemp is provided", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Water").length).toBeGreaterThan(0);
  });

  it("renders the Tide card label when tideStatus is provided", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Tide").length).toBeGreaterThan(0);
  });

  it("renders the Powered by Quiver branding card", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Powered by Quiver").length).toBeGreaterThan(0);
  });

  it("displays the wave height value as-is (units already in data)", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("displays the swell value combining period and direction", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("12 W").length).toBeGreaterThan(0);
  });

  it("displays the wind value combining speed and direction", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("10 NW").length).toBeGreaterThan(0);
  });

  it("displays the water temperature as-is (units already in data)", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("62").length).toBeGreaterThan(0);
  });

  it("displays the tide value combining status and height", () => {
    renderWidget(ALL_DATA);
    expect(screen.getAllByText("Rising 2.1").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Hides cards when specific data fields are null
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - partial data", () => {
  const PARTIAL_DATA: ConditionsData = {
    waveHeight: "3",
    windSpeed: "8",
  };

  it("renders the Waves label when waveHeight is provided", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.getAllByText("Waves").length).toBeGreaterThan(0);
  });

  it("renders the Wind label when windSpeed is provided", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.getAllByText("Wind").length).toBeGreaterThan(0);
  });

  it("does NOT render the Swell label when wavePeriod is absent", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.queryByText("Swell")).not.toBeInTheDocument();
  });

  it("does NOT render the Water label when waterTemp is absent", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.queryByText("Water")).not.toBeInTheDocument();
  });

  it("does NOT render the Tide label when tideStatus is absent", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.queryByText("Tide")).not.toBeInTheDocument();
  });

  it("still renders the Powered by Quiver branding when some data is present", () => {
    renderWidget(PARTIAL_DATA);
    expect(screen.getAllByText("Powered by Quiver").length).toBeGreaterThan(0);
  });

  it("omits card when field is explicitly null", () => {
    renderWidget({ waveHeight: "5", wavePeriod: null });
    expect(screen.queryByText("Swell")).not.toBeInTheDocument();
  });

  it("omits card when field is undefined", () => {
    renderWidget({ waveHeight: "5" });
    expect(screen.queryByText("Swell")).not.toBeInTheDocument();
  });

  it("shows swell period without direction when waveDirection is absent", () => {
    renderWidget({ wavePeriod: "10s" });
    expect(screen.getAllByText("10s").length).toBeGreaterThan(0);
  });

  it("shows wind speed without direction when windDirection is absent", () => {
    renderWidget({ windSpeed: "15 mph" });
    expect(screen.getAllByText("15 mph").length).toBeGreaterThan(0);
  });

  it("shows tide status without height when tideHeight is absent", () => {
    renderWidget({ tideStatus: "Falling" });
    expect(screen.getAllByText("Falling").length).toBeGreaterThan(0);
  });

  it("displays cards when value is '0' (flat/calm is valid)", () => {
    renderWidget({ waveHeight: "0", windSpeed: "0" });
    expect(screen.getAllByText("Waves").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wind").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. "No data available" when ALL fields are null / empty object
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - no data", () => {
  it("shows 'No data available' text when data is an empty object", () => {
    renderWidget({});
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("shows 'No data available' when all fields are explicitly null", () => {
    const emptyData: ConditionsData = {
      waveHeight: null,
      wavePeriod: null,
      waveDirection: null,
      windSpeed: null,
      windDirection: null,
      waterTemp: null,
      tideStatus: null,
      tideHeight: null,
    };
    renderWidget(emptyData);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("does NOT render any card labels when there is no data", () => {
    renderWidget({});
    expect(screen.queryByText("Waves")).not.toBeInTheDocument();
    expect(screen.queryByText("Swell")).not.toBeInTheDocument();
    expect(screen.queryByText("Wind")).not.toBeInTheDocument();
    expect(screen.queryByText("Water")).not.toBeInTheDocument();
    expect(screen.queryByText("Tide")).not.toBeInTheDocument();
  });

  it("does NOT render the branding card when there is no data", () => {
    renderWidget({});
    expect(screen.queryByText("Powered by Quiver")).not.toBeInTheDocument();
  });

  it("includes the beach name in the no-data container's title attribute", () => {
    renderWidget({});
    const noDataSpan = screen.getByText("No data available");
    expect(noDataSpan).toHaveAttribute("title", BEACH_NAME);
  });
});

// ---------------------------------------------------------------------------
// 4. Each card links to the correct beach URL with target="_blank"
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - link behavior", () => {
  it("all card anchor tags point to beachUrl", () => {
    renderWidget(ALL_DATA);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).toHaveAttribute("href", BEACH_URL);
    }
  });

  it("all card anchor tags open in a new tab (target=_blank)", () => {
    renderWidget(ALL_DATA);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
    }
  });

  it("branding card link also points to beachUrl", () => {
    renderWidget(ALL_DATA);
    // The branding text uniquely identifies the branding anchor in the static track
    const brandingLinks = screen
      .getAllByText("Powered by Quiver")
      .map((el) => el.closest("a"))
      .filter(Boolean);
    expect(brandingLinks.length).toBeGreaterThan(0);
    for (const link of brandingLinks) {
      expect(link).toHaveAttribute("href", BEACH_URL);
    }
  });

  it("link is present even when only one card is shown", () => {
    renderWidget({ waveHeight: "2" });
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", BEACH_URL);
  });
});

// ---------------------------------------------------------------------------
// 5. Theme classes
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - theme", () => {
  it("applies bg-white class on the container in light theme", () => {
    const { container } = renderWidget(ALL_DATA, "light");
    // The outer animated container carries the theme class
    const themedEl = container.querySelector(".bg-white");
    expect(themedEl).toBeInTheDocument();
  });

  it("applies bg-slate-900 class on the container in dark theme", () => {
    const { container } = renderWidget(ALL_DATA, "dark");
    const themedEl = container.querySelector(".bg-slate-900");
    expect(themedEl).toBeInTheDocument();
  });

  it("applies bg-slate-900 class on the no-data container in dark theme", () => {
    const { container } = renderWidget({}, "dark");
    const themedEl = container.querySelector(".bg-slate-900");
    expect(themedEl).toBeInTheDocument();
  });

  it("applies bg-white class on the no-data container in light theme", () => {
    const { container } = renderWidget({}, "light");
    const themedEl = container.querySelector(".bg-white");
    expect(themedEl).toBeInTheDocument();
  });

  it("does not apply bg-slate-900 in light theme", () => {
    const { container } = renderWidget(ALL_DATA, "light");
    const darkEl = container.querySelector(".bg-slate-900");
    expect(darkEl).not.toBeInTheDocument();
  });

  it("does not apply bg-white in dark theme", () => {
    const { container } = renderWidget(ALL_DATA, "dark");
    // The outer ticker group has bg-slate-900 in dark mode; bg-white should not be present
    const lightEl = container.querySelector(".bg-white");
    expect(lightEl).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. useEmbedImpression hook invocation
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - useEmbedImpression", () => {
  beforeEach(() => {
    (useEmbedImpression as jest.Mock).mockClear();
  });

  it("calls useEmbedImpression with 'ticker' as the type", () => {
    renderWidget(ALL_DATA, "light", "blacks-beach");
    expect(useEmbedImpression).toHaveBeenCalledWith("ticker", "blacks-beach");
  });

  it("calls useEmbedImpression with the slug passed via props", () => {
    renderWidget(ALL_DATA, "light", "ocean-beach-sf");
    expect(useEmbedImpression).toHaveBeenCalledWith("ticker", "ocean-beach-sf");
  });

  it("calls useEmbedImpression even when data is empty (no cards)", () => {
    renderWidget({}, "light", "empty-slug");
    expect(useEmbedImpression).toHaveBeenCalledWith("ticker", "empty-slug");
  });

  it("calls useEmbedImpression exactly once per render", () => {
    renderWidget(ALL_DATA, "light", "once-slug");
    expect(useEmbedImpression).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Accessibility
// ---------------------------------------------------------------------------

describe("EmbedTickerWidget - accessibility", () => {
  it("ticker container has an aria-label describing beach name and surf conditions", () => {
    renderWidget(ALL_DATA);
    const ticker = screen.getByLabelText(`${BEACH_NAME} surf conditions ticker`);
    expect(ticker).toBeInTheDocument();
  });

  it("animated track is marked aria-hidden to avoid duplicate announcements", () => {
    const { container } = renderWidget(ALL_DATA);
    const animatedTrack = container.querySelector(".ticker-animate");
    expect(animatedTrack).toHaveAttribute("aria-hidden", "true");
  });

  it("static fallback track is in the accessibility tree (no aria-hidden)", () => {
    const { container } = renderWidget(ALL_DATA);
    const staticTrack = container.querySelector(".ticker-static");
    expect(staticTrack).not.toHaveAttribute("aria-hidden");
  });

  it("SVG icons are aria-hidden to prevent noise for screen readers", () => {
    const { container } = renderWidget(ALL_DATA);
    const svgs = container.querySelectorAll("svg[aria-hidden='true']");
    expect(svgs.length).toBeGreaterThan(0);
  });
});
