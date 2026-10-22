/**
 * @jest-environment node
 */

// City water-temp/tide guides (/[intent]/[city]) exist only for US cities. Mexico
// city hubs linked to them anyway, and the US template they reached emitted
// /baja california/... links that Google crawled as 404s.

jest.mock("@/lib/supabase/server", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "or", "eq", "in", "is", "not", "order", "limit", "ilike"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
  return {
    createPublicReadClient: () => ({ from: () => builder }),
    createSupabaseServerClient: async () => ({ from: () => builder }),
  };
});

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { EditorialLayout } from "@/app/beaches/[country]/[state]/[city]/editorial-layout";
import { StandardLayout } from "@/app/beaches/[country]/[state]/[city]/standard-layout";
import { SeoFunnelNextSteps } from "@/components/seo/seo-funnel-next-steps";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";
import { mockSanDiegoEditorial } from "@/__tests__/fixtures/city-editorial";
import type { BeachWithMetrics, LocationStats } from "@/types/location";

function findElements(node: ReactNode, type: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => findElements(child, type, found));
    return found;
  }
  if (!isValidElement(node)) return found;
  if (node.type === type) found.push(node);
  findElements((node.props as { children?: ReactNode }).children, type, found);
  return found;
}

function nextStepHrefs(tree: ReactNode): string[] {
  const [nextSteps] = findElements(tree, SeoFunnelNextSteps);
  return (nextSteps.props as { steps: { href: string }[] }).steps.map((step) => step.href);
}

function hubBeach(index: number, city: string, state: string, country: string): BeachWithMetrics {
  return {
    id: `00000000-0000-4000-8000-00000000002${index}`,
    name: `Point ${index}`,
    slug: `point-${index}`,
    city,
    state,
    country,
    lat: 30.8 + index / 100,
    lon: -116.1,
    skill_level: "advanced",
    crowd_level: "light",
    break_type: "point",
    best_conditions_prose: "Clean west swell.",
    description: "A point break.",
    average_rating: 4.5,
    review_count: 20,
    composite_score: 0.8,
    recent_intel_count: 3,
    avg_confirmations: 1,
    compositeScore: 0.8,
    recentIntelCount: 3,
    avgConfirmations: 1,
  } as unknown as BeachWithMetrics;
}

const STATS: LocationStats = {
  locationName: "Camalú",
  stateName: "Baja California",
  countryName: "Mexico",
  totalBeaches: 2,
  averageRating: 4.5,
  totalReviews: 40,
  topBeaches: 2,
};

const US_PARAMS = { country: "usa", state: "ca", city: "test-harbor" };
const MX_PARAMS = { country: "mexico", state: "baja-california", city: "camalu" };
const usBeaches = [1, 2].map((i) => hubBeach(i, "Test Harbor", "CA", "USA"));
const mxBeaches = [1, 2].map((i) => hubBeach(i, "Camalú", "Baja California", "Mexico"));

function standardHub(params: typeof US_PARAMS, beaches: BeachWithMetrics[], bestTimeToSurfUrl?: string) {
  return StandardLayout({
    params,
    displayCityName: params === US_PARAMS ? "Test Harbor" : "Camalú",
    stats: STATS,
    location: params === US_PARAMS
      ? { country: "USA", state: "CA", city: "Test Harbor" }
      : { country: "Mexico", state: "Baja California", city: "Camalú" },
    beaches,
    metroConfig: null,
    jsonLd: {},
    itemListItems: [],
    bestTimeToSurfUrl,
  });
}

describe("city hub links into US-only intent pages", () => {
  it("links a US hub to its water-temp and tide guides", () => {
    const tree = standardHub(US_PARAMS, usBeaches, "/best-time-to-surf/test-harbor");

    expect(nextStepHrefs(tree)).toEqual([
      "/best-time-to-surf/test-harbor",
      "/water-temp/test-harbor",
      "/tide/test-harbor",
    ]);
    expect(findElements(tree, IntentGuidesGrid)).toHaveLength(1);
  });

  it("keeps a Mexico hub off the US-only intent pages", () => {
    const tree = standardHub(MX_PARAMS, mxBeaches, "/best-time-to-surf/camalu");

    expect(nextStepHrefs(tree)).toEqual(["/best-time-to-surf/camalu"]);
    expect(findElements(tree, IntentGuidesGrid)).toHaveLength(0);
  });

  it("keeps an editorial Mexico hub off the US-only intent pages", () => {
    const tree = EditorialLayout({
      params: MX_PARAMS,
      displayCityName: "Camalú",
      stats: STATS,
      beaches: mxBeaches,
      editorial: mockSanDiegoEditorial,
      jsonLd: {},
      itemListItems: [],
    });

    expect(nextStepHrefs(tree)).toEqual(["/best-time-to-surf/camalu"]);
    expect(findElements(tree, GuidesByIntentGrid)).toHaveLength(0);
  });
});
