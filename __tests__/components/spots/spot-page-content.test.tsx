import type { ImgHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

import { SpotPageContent } from "@/components/spots/spot-page-content";
import type { SpotPageData } from "@/lib/utils/spot-data-transformer";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    unoptimized?: boolean;
  }) => <img alt={alt} {...props} />,
}));

jest.mock("@/components/spots/spot-hero-section", () => ({
  SpotHeroSection: ({ spotName }: { spotName: string }) => (
    <div data-testid="spot-hero">Hero {spotName}</div>
  ),
}));

jest.mock("@/components/spots/spot-photo-gallery", () => ({
  SpotPhotoGallery: ({
    beachId,
    spotName,
  }: {
    beachId: string;
    spotName: string;
  }) => <div data-testid="spot-gallery">{`${spotName}-${beachId}`}</div>,
}));

jest.mock("@/components/spots/spot-location-map", () => ({
  SpotLocationMap: ({
    spotName,
  }: {
    latitude: number;
    longitude: number;
    spotName: string;
  }) => <div data-testid="spot-map">Map {spotName}</div>,
}));

function makeSpot(overrides: Partial<SpotPageData> = {}): SpotPageData {
  return {
    id: "spot-1",
    slug: "huntington-beach-pier",
    name: "Huntington Beach Pier",
    latitude: 33.655,
    longitude: -117.998,
    city: "Huntington Beach",
    state: "CA",
    region: "Orange County, CA",
    citySlug: "huntington-beach",
    description: "A dependable South Orange County beach break.",
    breakType: "sandbar",
    skillLevel: "Intermediate",
    hazards: ["crowds", "strong sweep"],
    features: ["parking", "showers"],
    parkingTips: "Use the south lot before dawn patrol.",
    bestConditions: "Best on a combo swell with light east wind.",
    overview: "A classic beach break with several peaks around the pier.",
    history: "This stretch has decades of contest and local lineage.",
    conditions: "Works best with clean morning wind and a little push tide.",
    tideAdvice: "Low to mid tide tends to keep the peaks lined up.",
    swellAdvice: "Mix of WNW swell and a little south pulse keeps it playful.",
    windAdvice: "Early light east wind keeps the face cleaner.",
    waterTemp: "Most of the year calls for a 3/2 or 4/3.",
    bestSeason: "Fall",
    crowdFactor: "Heavy",
    parking: "Metered lots fill quickly on warm weekends.",
    amenities: ["showers", "bathrooms", "boardwalk"],
    nearby: ["bolsa-chica", "newport-56th-street"],
    faq: [
      {
        question: "Is Huntington Beach Pier beginner friendly?",
        answer: "On small, clean days the shoulders can work, but crowds matter.",
      },
    ],
    speakableSummary: "Huntington Beach Pier is a lively beach break with multiple peaks.",
    beginnerNotes: "Beginners do best on smaller, cleaner mornings with some room to drift wide.",
    intentTags: ["beginner", "dawn-patrol"],
    ...overrides,
  };
}

describe("SpotPageContent", () => {
  it("renders the refreshed visual modules for a rich spot payload", () => {
    render(
      <SpotPageContent
        spot={makeSpot()}
        cityName="Huntington Beach"
        updatedAt="May 22, 2026 at 6:30 AM"
        featuredPhotoUrl="https://example.com/featured.jpg"
        featuredPhotoAttribution="Photo credit"
        nearbySpots={[
          {
            slug: "bolsa-chica",
            name: "Bolsa Chica",
            city: "Huntington Beach",
            state: "CA",
            region: "Orange County, CA",
            overview: "A mellow sandbar backup when the main peaks get hectic.",
            breakType: "sandbar",
            skillLevel: "Beginner",
            tideAdvice: "Mid tide is the easier read.",
            swellAdvice: "Small WNW with low wind is best.",
            windAdvice: "Morning is cleaner.",
            photoUrl: "https://example.com/bolsa.jpg",
          },
        ]}
      />
    );

    expect(screen.getByTestId("spot-hero")).toHaveTextContent(
      "Hero Huntington Beach Pier"
    );
    expect(screen.getByTestId("spot-summary-card")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How to read Quiver wave height" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("spot-planning-grid")).toBeInTheDocument();
    const decorativeImages = screen.getAllByAltText("");
    expect(decorativeImages.some((image) =>
      image.getAttribute("src") === "/images/spot-icons/tide-window.png"
    )).toBe(true);
    expect(decorativeImages.some((image) =>
      image.getAttribute("src") === "/images/spot-icons/launch-arrow.png"
    )).toBe(true);
    expect(screen.getByTestId("spot-gallery")).toHaveTextContent(
      "Huntington Beach Pier-spot-1"
    );
    expect(screen.getByTestId("spot-nearby-grid")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Huntington Beach Pier FAQs" })
    ).toBeInTheDocument();
  });

  it("keeps sparse DB-only spots lean when gallery and nearby data are missing", () => {
    render(
      <SpotPageContent
        spot={makeSpot({
          id: null,
          latitude: null,
          longitude: null,
          tideAdvice: null,
          swellAdvice: null,
          windAdvice: null,
          waterTemp: null,
          bestSeason: null,
          breakType: null,
          skillLevel: null,
          nearby: null,
          faq: null,
          beginnerNotes: null,
          crowdFactor: null,
          hazards: null,
          parking: null,
          parkingTips: null,
          amenities: null,
        })}
        cityName="Orange County"
        updatedAt="May 22, 2026 at 6:30 AM"
        featuredPhotoUrl={null}
        nearbySpots={[]}
      />
    );

    expect(screen.queryByTestId("spot-gallery")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spot-nearby-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spot-map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("spot-planning-grid")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pivot plan" })
    ).toBeInTheDocument();
  });

  it("switches between beginner notes and fallback planning links", () => {
    const { rerender } = render(
      <SpotPageContent
        spot={makeSpot()}
        cityName="Huntington Beach"
        updatedAt="May 22, 2026 at 6:30 AM"
        featuredPhotoUrl={null}
        nearbySpots={[]}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Beginner notes" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /See beginner spots in Huntington Beach/i })
    ).toBeInTheDocument();

    rerender(
      <SpotPageContent
        spot={makeSpot({ beginnerNotes: null })}
        cityName="Huntington Beach"
        updatedAt="May 22, 2026 at 6:30 AM"
        featuredPhotoUrl={null}
        nearbySpots={[]}
      />
    );

    expect(screen.getByRole("heading", { name: "Pivot plan" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Find a less crowded Huntington Beach backup/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Longboard spots/i })
    ).toBeInTheDocument();
  });
});
