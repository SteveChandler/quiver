import { render, screen } from "@testing-library/react";

const mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({ useSearchParams: () => mockParams }));
jest.mock("@/components/oracle/zine/home-hero-media", () => ({
  HomeHeroMedia: ({ children, viewpointPriority }: { children: React.ReactNode; viewpointPriority: string[] }) => (
    <figure data-testid="hero-media" data-priority={viewpointPriority.join(",")}>{children}</figure>
  ),
}));
jest.mock("@/components/beach-detail/rip-current-warning", () => ({ RipCurrentWarning: () => <div data-testid="rip" /> }));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));

import { BeachVisualHero } from "@/components/beach-detail/visual/beach-visual-hero";

const PROPS = {
  beach: { id: "b1", name: "Tourmaline", lat: 32.8, lon: -117.26, city: "San Diego" },
  timezone: "America/Los_Angeles",
  localDate: "2026-09-27",
  forecastLocalDate: "2026-09-27",
  photoUrl: "https://example.com/t.jpg",
  sources: null,
  swellPartition: null,
  call: { kind: "call" as const, label: "FAIR" as const, action: "Worth a look" },
  surf: { size: "2–3 ft", swell: "11s SW", wind: "9 mph cross-shore", bestWindow: "11am–1:30pm" },
  beachDay: { water: "73°F · Boardshorts", nextLow: "Low 3:10 PM", advisory: null },
};

describe("BeachVisualHero", () => {
  it("keeps the H1's words with the beach name large", () => {
    render(<BeachVisualHero {...PROPS} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Tourmaline Surf Forecast for Sunday, September 27, 2026");
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
});
