import { fireEvent, render, screen } from "@testing-library/react";

const mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));
jest.mock("@/components/oracle/zine/home-hero-media", () => ({
  HomeHeroMedia: ({
    children,
    viewpointPriority,
    storageKey,
    onViewpointChange,
  }: {
    children: React.ReactNode;
    viewpointPriority: string[];
    storageKey: string;
    onViewpointChange?: (viewpoint: string) => void;
  }) => (
    <figure data-testid="hero-media" data-priority={viewpointPriority.join(",")} data-storage-key={storageKey}>
      <button type="button" data-testid="hero-media-switch-satellite" onClick={() => onViewpointChange?.("satellite")}>
        Switch to satellite
      </button>
      {children}
    </figure>
  ),
}));
jest.mock("@/components/beach-detail/rip-current-warning", () => ({
  RipCurrentWarning: ({ localDate }: { localDate: string }) => <div data-testid="rip" data-local-date={localDate} />,
}));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));

import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";
import { BeachVisualHero } from "@/components/beach-detail/visual/beach-visual-hero";

const mockCapture = captureClientPostHogEventAfterConsent as jest.Mock;

const PROPS = {
  beach: { id: "b1", name: "Tourmaline", lat: 32.8, lon: -117.26, city: "San Diego" },
  timezone: "America/Los_Angeles",
  localDate: "2026-09-27",
  forecastLocalDate: "2026-09-27",
  photoUrl: "https://example.com/t.jpg",
  sources: null,
  isTomorrow: false,
  swellPartition: null,
  call: { kind: "call" as const, label: "FAIR" as const, action: "Worth a look" },
  surf: { size: "2–3 ft", swell: "11s SW", wind: "9 mph cross-shore", bestWindow: "11am–1:30pm" },
  beachDay: { water: "73°F · Boardshorts", nextLow: "Low 3:10 PM", advisory: null },
};

describe("BeachVisualHero", () => {
  beforeEach(() => {
    mockCapture.mockClear();
    mockParams.delete("date");
    mockParams.delete("window");
  });

  it("keeps the H1's words with the beach name large", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tourmaline Surf Forecast for Sunday, September 27, 2026");
  });

  it.each([
    [false, "today", "call"],
    [true, "tomorrow", "call"],
    [false, "today", "no_call"],
    [true, "tomorrow", "no_call"],
  ] as const)("uses the call day for isTomorrow=%s and %s %s", (isTomorrow, day, kind) => {
    const call = kind === "call" ? PROPS.call : { kind, reason: "Water-quality advisory" };
    render(<BeachVisualHero {...PROPS} isTomorrow={isTomorrow} call={call} />);
    const card = screen.getByTestId("beach-public-call");
    expect(card).toHaveTextContent(`Surfing ${day} · for most surfers`);
    expect(card).toHaveTextContent(kind === "call" ? "FairWorth a look" : `No call ${day}`);
    expect(card).not.toHaveTextContent(isTomorrow ? "today" : "tomorrow");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tourmaline Surf Forecast for Sunday, September 27, 2026");
    expect(screen.getByText("Beach day today")).toBeInTheDocument();
  });

  it("leads with the cam, then the photo", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByTestId("hero-media")).toHaveAttribute("data-priority", "cam,photo,swell,satellite");
  });

  it("gives everyone the surf call, for most surfers", () => {
    render(<BeachVisualHero {...PROPS} />);
    const call = screen.getByTestId("beach-public-call");
    expect(call).toHaveTextContent("Fair");
    expect(call).toHaveTextContent("Worth a look");
    expect(call).toHaveTextContent(/for most surfers/i);
  });

  it("shows a hold instead of a call", () => {
    render(<BeachVisualHero {...PROPS} call={{ kind: "no_call", reason: "There's a water-quality advisory here, so there's no call until it clears." }} />);
    const call = screen.getByTestId("beach-public-call");
    expect(call).toHaveTextContent("No call today");
    expect(call).toHaveTextContent("water-quality advisory");
    expect(call).not.toHaveTextContent(/worth|good|fair/i);
  });

  it("says the call is unavailable when unknown, without a tier word", () => {
    render(<BeachVisualHero {...PROPS} call={{ kind: "unknown" }} />);
    const call = screen.getByTestId("beach-public-call");
    expect(call).toHaveTextContent("Surf call unavailable");
    expect(call).not.toHaveTextContent(/worth|good|fair|rideable|meh/i);
  });

  it("pins the hero's own storage key", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByTestId("hero-media")).toHaveAttribute("data-storage-key", "quiver:beach-hero-viewpoint");
  });

  it("reports a viewpoint change with the beach id", () => {
    render(<BeachVisualHero {...PROPS} />);
    fireEvent.click(screen.getByTestId("hero-media-switch-satellite"));
    expect(mockCapture).toHaveBeenCalledWith("beach_hero_viewpoint_changed", { beach_id: "b1", viewpoint: "satellite" });
  });

  it("omits facts it doesn't have", () => {
    render(<BeachVisualHero {...PROPS} surf={{ size: null, swell: null, wind: null, bestWindow: null }} beachDay={{ water: null, nextLow: null, advisory: null }} />);
    const hero = screen.getByTestId("beach-visual-hero");
    expect(hero.textContent).not.toMatch(/null|NaN|undefined/);
    expect(screen.queryByText(/beach day today/i)).toBeNull();
  });

  it("drops the date from the H1 for a selected window", () => {
    mockParams.set("window", "2026-09-28T15:00:00.000Z");
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Tourmaline\s*Surf Forecast$/);
    mockParams.delete("window");
  });

  it("passes the selected day to the rip-current warning", () => {
    mockParams.set("date", "2026-09-29");
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByTestId("rip")).toHaveAttribute("data-local-date", "2026-09-29");
  });
});
