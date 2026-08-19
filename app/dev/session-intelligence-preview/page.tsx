import { notFound } from "next/navigation";

import { BestSurfWindows } from "@/components/session-intelligence";
import type { SurfWindowRecommendation } from "@/types/session-intelligence";

function getPreviewLocalTimeLabel(rank: number): string {
  if (rank === 1) {
    return "7:00-9:30 AM";
  }

  if (rank === 2) {
    return "9:00-11:00 AM";
  }

  return "10:00 AM-12:00 PM";
}

function getPreviewBeachId(rank: number): string {
  if (rank === 1) return "15c7337e-5258-4339-9dc3-c435c666926b";
  if (rank === 2) return "65d177de-e75a-4ad8-aa0d-48a67c0851b0";
  return "e8a921b7-c2b5-4259-9e5c-bd06765f7ae4";
}

function getPreviewPhotoUrl(rank: number): string {
  if (rank === 1) return "/images/OceanBeachSurfers.jpg";
  if (rank === 2) return "/images/blacks.jpg";
  return "/images/tourmaline.png";
}

function recommendationFixture(
  rank: number,
  overrides: Partial<SurfWindowRecommendation> = {}
): SurfWindowRecommendation {
  return {
    windowId: `preview-beach-${rank}-2026-06-03T14-00-00-000Z`,
    rank,
    beach: {
      id: getPreviewBeachId(rank),
      name: rank === 1 ? "Ocean Beach" : `Preview Beach ${rank}`,
      slug: rank === 1 ? "ocean-beach" : `preview-beach-${rank}`,
      city: "San Diego",
      state: "CA",
      country: "USA",
      region: "Southern California",
      lat: 32.75,
      lon: -117.25,
      photoUrl: getPreviewPhotoUrl(rank),
    },
    startIso: "2026-06-03T14:00:00.000Z",
    endIso: "2026-06-03T16:30:00.000Z",
    peakIso: "2026-06-03T15:00:00.000Z",
    timezone: "America/Los_Angeles",
    forecastAt: "2026-06-03T14:00:00.000Z",
    localTimeLabel: getPreviewLocalTimeLabel(rank),
    score: 86 - rank * 8,
    verdict: rank === 3 ? "Maybe" : "Worth it",
    headline:
      rank === 1
        ? "7:00-9:30 AM looks worth it at Ocean Beach"
        : `Window ${rank} is worth watching`,
    wave: {
      height: rank === 3 ? "2" : "4",
      period: rank === 3 ? null : "12s",
      direction: rank === 3 ? null : "W",
      summary: rank === 3 ? "Wave data is sparse" : "4 ft at 12s from W",
    },
    wind: {
      speed: rank === 2 ? "8" : "5",
      direction: rank === 2 ? "W" : "NE",
      quality: rank === 2 ? "cross-shore" : "offshore",
      summary: rank === 2 ? "8 W (cross-shore)" : "5 NE (offshore)",
    },
    tide: {
      status: "Rising",
      height: "3.5",
      nextTideAt: "2026-06-03T18:00:00.000Z",
      trend: "rising",
      summary: "Rising, 3.5 ft",
    },
    bestFor: rank === 3 ? ["beginner", "foamie"] : ["intermediate", "longboard", "dawn-patrol"],
    positives: ["Good wave size", "Light offshore wind"],
    watchouts: rank === 2 ? ["Cross-shore texture could show up"] : [],
    dataNotes: [],
    confidence: {
      level: rank === 3 ? "low" : "high",
      score: rank === 3 ? 34 : 82,
      summary: rank === 3 ? "Low confidence" : "High confidence",
      reasons: rank === 3
        ? ["Forecast confidence is low"]
        : ["Forecast model row is present", "Tide data is present"],
    },
    sources: {
      forecastModel: true,
      tide: true,
      buoy: rank !== 3,
      cam: false,
      userReport: false,
      localSpotIntel: true,
    },
    appDeepLink: `/beach/ocean-beach?window=preview-window-${rank}`,
    universalLink: `https://www.quiversurf.app/beach/ocean-beach?window=preview-window-${rank}`,
    canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
    ...overrides,
  };
}

const recommendations: SurfWindowRecommendation[] = [
  recommendationFixture(1),
  recommendationFixture(2),
  recommendationFixture(3, {
    tide: {
      status: null,
      height: null,
      nextTideAt: null,
      trend: "unknown",
      summary: "Tide data is unavailable",
    },
    sources: {
      forecastModel: true,
      tide: false,
      buoy: false,
      cam: false,
      userReport: false,
      localSpotIntel: false,
    },
    dataNotes: [
      "Tide data is unavailable for this window",
      "No buoy source is attached to this window",
      "No cam source is attached to this window",
      "No user-report source is attached to this window",
    ],
  }),
];

export default function SessionIntelligencePreviewPage() {
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#252D6B] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-normal text-ocean-blue">
            Dev preview
          </p>
          <h1 className="font-heading text-2xl font-bold md:text-3xl">
            Session Intelligence components
          </h1>
        </div>
        <BestSurfWindows
          recommendations={recommendations}
          subtitle="Static fixture data for responsive validation."
          layout="feature-list"
          surface="dev_preview"
        />
      </div>
    </main>
  );
}
