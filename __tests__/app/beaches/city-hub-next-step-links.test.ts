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
import { resolveIntentCitySlug } from "@/app/beaches/[country]/[state]/[city]/city-page-utils";
import { getMetroConfig, type MetroAreaConfig } from "@/lib/constants/metro-areas";
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
    intentCitySlug: params.city,
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
      intentCitySlug: MX_PARAMS.city,
      displayCityName: "Camalú",
      stats: STATS,
      beaches: mxBeaches,
      editorial: mockSanDiegoEditorial,
      jsonLd: {},
      itemListItems: [],
    });

    // No bestTimeToSurfUrl means no best-time page exists; the old fallback
    // linked /best-time-to-surf/camalu anyway.
    expect(nextStepHrefs(tree)).toEqual([]);
    expect(findElements(tree, GuidesByIntentGrid)).toHaveLength(0);
  });
});

const LONG_BEACH_PARAMS = { country: "usa", state: "ca", city: "long-beach" };
const LONG_BEACH_LOCATION = { country: "USA", state: "CA", city: "Long Beach" };
const longBeachBeaches = [1, 2].map((i) => hubBeach(i, "Long Beach", "CA", "USA"));
const ENCINITAS_PARAMS = { country: "usa", state: "ca", city: "encinitas" };
const encinitasBeaches = [1, 2].map((i) => hubBeach(i, "Encinitas", "CA", "USA"));

interface HubOptions {
  params: typeof US_PARAMS;
  location: { country: string; state: string; city: string };
  displayCityName: string;
  beaches: BeachWithMetrics[];
  intentCitySlug: string | null;
  bestTimeToSurfUrl?: string;
  metroConfig?: MetroAreaConfig | null;
}

function standardTree(options: HubOptions): ReactNode {
  return StandardLayout({
    params: options.params,
    intentCitySlug: options.intentCitySlug,
    displayCityName: options.displayCityName,
    stats: STATS,
    location: options.location,
    beaches: options.beaches,
    metroConfig: options.metroConfig ?? null,
    jsonLd: {},
    itemListItems: [],
    bestTimeToSurfUrl: options.bestTimeToSurfUrl,
  });
}

function editorialTree(options: HubOptions): ReactNode {
  return EditorialLayout({
    params: options.params,
    intentCitySlug: options.intentCitySlug,
    displayCityName: options.displayCityName,
    stats: STATS,
    beaches: options.beaches,
    editorial: mockSanDiegoEditorial,
    jsonLd: {},
    itemListItems: [],
    bestTimeToSurfUrl: options.bestTimeToSurfUrl,
  });
}

describe.each([
  ["standard", standardTree],
  ["editorial", editorialTree],
] as const)("%s city hub next steps", (_layout, renderHub) => {
  it("links a collision city (Long Beach, CA) to the state-suffixed intent pages", () => {
    const tree = renderHub({
      params: LONG_BEACH_PARAMS,
      location: LONG_BEACH_LOCATION,
      displayCityName: "Long Beach",
      beaches: longBeachBeaches,
      intentCitySlug: resolveIntentCitySlug(LONG_BEACH_PARAMS, LONG_BEACH_LOCATION, null),
      bestTimeToSurfUrl: "/best-time-to-surf/long-beach-ca",
    });

    expect(nextStepHrefs(tree)).toEqual([
      "/best-time-to-surf/long-beach-ca",
      "/water-temp/long-beach-ca",
      "/tide/long-beach-ca",
    ]);
  });

  it("keeps a normal city's hrefs unchanged", () => {
    const location = { country: "USA", state: "CA", city: "Encinitas" };
    const tree = renderHub({
      params: ENCINITAS_PARAMS,
      location,
      displayCityName: "Encinitas",
      beaches: encinitasBeaches,
      intentCitySlug: resolveIntentCitySlug(ENCINITAS_PARAMS, location, null),
      bestTimeToSurfUrl: "/best-time-to-surf/encinitas",
    });

    expect(nextStepHrefs(tree)).toEqual([
      "/best-time-to-surf/encinitas",
      "/water-temp/encinitas",
      "/tide/encinitas",
    ]);
  });

  it("omits the best-time step when no best-time page exists", () => {
    const location = { country: "USA", state: "CA", city: "Encinitas" };
    const tree = renderHub({
      params: ENCINITAS_PARAMS,
      location,
      displayCityName: "Encinitas",
      beaches: encinitasBeaches,
      intentCitySlug: resolveIntentCitySlug(ENCINITAS_PARAMS, location, null),
    });

    expect(nextStepHrefs(tree)).toEqual(["/water-temp/encinitas", "/tide/encinitas"]);
  });
});

describe("metro hub next steps", () => {
  it("links the Orange County metro to no tide, water-temp or best-time page", () => {
    const metroConfig = getMetroConfig("orange-county");
    const params = { country: "usa", state: "ca", city: "orange-county" };
    const location = { country: "USA", state: "CA", city: "Orange County" };
    const tree = standardTree({
      params,
      location,
      displayCityName: "Orange County",
      beaches: [1, 2].map((i) => hubBeach(i, "Huntington Beach", "CA", "USA")),
      intentCitySlug: resolveIntentCitySlug(params, location, metroConfig),
      metroConfig,
    });

    const hrefs = nextStepHrefs(tree);
    expect(hrefs).not.toContain("/tide/orange-county");
    expect(hrefs).not.toContain("/water-temp/orange-county");
    expect(hrefs).not.toContain("/best-time-to-surf/orange-county");
    expect(hrefs).toEqual([]);
  });

  it("still links the San Diego metro to its city tide and water-temp pages", () => {
    const metroConfig = getMetroConfig("san-diego");
    const params = { country: "usa", state: "ca", city: "san-diego" };
    const location = { country: "USA", state: "CA", city: "San Diego" };
    const tree = standardTree({
      params,
      location,
      displayCityName: "San Diego",
      beaches: [1, 2].map((i) => hubBeach(i, "San Diego", "CA", "USA")),
      intentCitySlug: resolveIntentCitySlug(params, location, metroConfig),
      bestTimeToSurfUrl: "/best-time-to-surf/san-diego",
      metroConfig,
    });

    expect(nextStepHrefs(tree)).toEqual([
      "/best-time-to-surf/san-diego",
      "/water-temp/san-diego",
      "/tide/san-diego",
    ]);
  });
});
