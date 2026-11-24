import React from "react";
import { render, screen } from "@testing-library/react";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { ZineHero } from "@/components/beach-detail/zine/zine-hero";
import { ZineSpotSummary } from "@/components/beach-detail/zine/zine-spot-summary";
import { ZineNearbySpots } from "@/components/beach-detail/zine/zine-nearby-spots";
import { ZineRecentSessions } from "@/components/beach-detail/zine/zine-recent-sessions";
import { PopularBeachesSection } from "@/components/landing-page/popular-beaches-section";
import type { EnrichedNearbyBeach } from "@/lib/utils/nearby-beach-enrichment";
import type { EnrichedBeach } from "@/lib/data/server/featured-beaches";
import type { SessionWithDetails } from "@/types/database";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

const mockUseDataFetcher = jest.fn();
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: (...args: unknown[]) => mockUseDataFetcher(...args),
}));

beforeAll(() => {
  // ZineNearbySpots tracks impressions with an IntersectionObserver.
  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  };
});

describe("beach pages with an unrated skill level or break type", () => {
  it("hero shows no skill or break chip when both are null", () => {
    const beach = createMockBeach({ name: "Bolsa Chica", skill_level: null, break_type: null });
    render(<ZineHero beach={beach} />);

    expect(screen.queryByText("ALL")).not.toBeInTheDocument();
    expect(screen.queryByText("SPOT")).not.toBeInTheDocument();
    expect(screen.queryByText("BREAK")).not.toBeInTheDocument();
  });

  it("hero hides the About section when it has no chips and no prose", () => {
    const beach = createMockBeach({
      name: "Fort Ebey",
      skill_level: null,
      break_type: null,
      average_rating: null,
      review_count: 0,
      best_conditions_prose: null,
    });
    render(<ZineHero beach={beach} />);

    expect(screen.queryByText(/About this spot/)).not.toBeInTheDocument();
  });

  it("hero keeps the About section for prose alone, with no empty chip row", () => {
    const beach = createMockBeach({
      skill_level: null,
      break_type: null,
      average_rating: null,
      review_count: 0,
      best_conditions_prose: "Works on a west swell at mid tide.",
    });
    const { container } = render(<ZineHero beach={beach} />);

    expect(screen.getByText(/About this spot/)).toBeInTheDocument();
    expect(container.querySelector("details .flex.flex-wrap")).toBeNull();
  });

  it("hero keeps a rated skill level and break type", () => {
    const beach = createMockBeach({ skill_level: "beginner", break_type: "beach" });
    render(<ZineHero beach={beach} />);

    expect(screen.getByText("BEGINNER")).toBeInTheDocument();
    expect(screen.getByText("BEACH")).toBeInTheDocument();
  });

  it("spot summary hides the break type when it is null", () => {
    render(<ZineSpotSummary beach={createMockBeach({ break_type: null })} />);

    expect(screen.queryByText("BREAK TYPE:")).not.toBeInTheDocument();
    expect(screen.queryByText("BEACH")).not.toBeInTheDocument();
    expect(screen.getByText("BEST SWELL:")).toBeInTheDocument();
  });

  it("nearby card shows no skill when it is null", () => {
    const nearby = {
      id: "b1",
      name: "Fort Ebey",
      slug: "fort-ebey-coupeville-wa",
      city: "Coupeville",
      state: "WA",
      country: "US",
      skill_level: null,
      waveHeight: null,
      score: null,
    } as unknown as EnrichedNearbyBeach;
    render(<ZineNearbySpots beaches={[nearby]} sourceBeachName="Test" />);

    expect(screen.getByText("Fort Ebey")).toBeInTheDocument();
    expect(screen.queryByText("All")).not.toBeInTheDocument();
  });

  it("popular beach card shows no skill when it is null", () => {
    const beach = {
      id: "b1",
      name: "Cowell Beach",
      slug: "cowell-beach-santa-cruz-ca",
      city: "Santa Cruz",
      state: "CA",
      country: "US",
      skill_level: null,
      photo_url: null,
      average_rating: null,
      review_count: 0,
    } as unknown as EnrichedBeach;
    render(<PopularBeachesSection beaches={[beach]} />);

    expect(screen.getByText("Cowell Beach")).toBeInTheDocument();
    expect(screen.queryByText("All levels")).not.toBeInTheDocument();
  });
});

describe("ZineRecentSessions caption", () => {
  it("renders no quote when the session has no notes", () => {
    const session = {
      id: "s1",
      notes: null,
      description: null,
      rating: 4,
      created_at: "2026-11-01T15:00:00Z",
      profiles: { full_name: "Kai Lane" },
    } as unknown as SessionWithDetails;
    mockUseDataFetcher.mockReturnValue({
      data: { sessions: [session], approvedPhotos: [] },
      loading: false,
    });
    render(<ZineRecentSessions beachId="b1" />);

    expect(screen.getByText("Kai Lane")).toBeInTheDocument();
    expect(screen.queryByText(/logged a session/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[“”]/);
  });

  it("quotes the surfer's own notes", () => {
    const session = {
      id: "s2",
      notes: "Fun peaks on the push",
      rating: 4,
      created_at: "2026-11-01T15:00:00Z",
      profiles: { full_name: "Kai Lane" },
    } as unknown as SessionWithDetails;
    mockUseDataFetcher.mockReturnValue({
      data: { sessions: [session], approvedPhotos: [] },
      loading: false,
    });
    render(<ZineRecentSessions beachId="b1" />);

    expect(screen.getByText(/Fun peaks on the push/)).toBeInTheDocument();
  });
});
