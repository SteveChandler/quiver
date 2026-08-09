export const FORECAST_BENCHMARK_QUERY_CLASSES = [
  "spot-surf-forecast",
  "spot-surf-report",
  "spot-tomorrow",
  "best-time-to-surf-spot",
  "when-should-i-surf-spot",
  "spot-swell-tomorrow",
  "spot-wind-tomorrow",
  "spot-tide-tomorrow",
  "best-surf-region-tomorrow",
  "where-should-i-surf-region-tomorrow",
] as const;

export type ForecastBenchmarkQueryClass =
  (typeof FORECAST_BENCHMARK_QUERY_CLASSES)[number];

const SPOT_QUERY_CLASSES = [
  "spot-surf-forecast",
  "spot-surf-report",
  "spot-tomorrow",
  "best-time-to-surf-spot",
  "when-should-i-surf-spot",
  "spot-swell-tomorrow",
  "spot-wind-tomorrow",
  "spot-tide-tomorrow",
] as const;

export interface ForecastBenchmarkSpot {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  canonicalPath: string;
}

export interface ForecastBenchmarkQuery {
  queryClass: ForecastBenchmarkQueryClass;
  query: string;
  spotId: string | null;
  region: string;
  canonicalPath: string | null;
}

export interface ForecastAnswerContractFacts {
  answerLayer: boolean;
  forecastDate: boolean;
  surfFacts: boolean;
  bestWindow: boolean;
  reasoning: boolean;
  freshness: boolean;
  provenance: boolean;
  score: number;
}

const EAST_COAST_STATES = new Set([
  "ct", "de", "fl", "ga", "ma", "md", "me", "nc", "nh", "nj", "ny", "ri", "sc", "va",
]);
const GULF_STATES = new Set(["al", "fl", "la", "ms", "tx"]);

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function classifyForecastBenchmarkRegion(spot: ForecastBenchmarkSpot): string {
  const country = normalized(spot.country);
  const state = normalized(spot.state);
  if (country === "usa" || country === "us" || country === "united states") {
    if (state === "ca" || state === "california") return "California";
    if (state === "hi" || state === "hawaii") return "Hawaii";
    if (GULF_STATES.has(state)) return "Gulf Coast";
    if (EAST_COAST_STATES.has(state)) return "East Coast";
  }
  return "International";
}

function spotQuery(
  spot: ForecastBenchmarkSpot,
  queryClass: Exclude<ForecastBenchmarkQueryClass, "best-surf-region-tomorrow" | "where-should-i-surf-region-tomorrow">,
): string {
  const name = spot.name;
  switch (queryClass) {
    case "spot-surf-forecast": return `${name} surf forecast`;
    case "spot-surf-report": return `${name} surf report`;
    case "spot-tomorrow": return `${name} tomorrow`;
    case "best-time-to-surf-spot": return `best time to surf ${name}`;
    case "when-should-i-surf-spot": return `when should I surf ${name}`;
    case "spot-swell-tomorrow": return `${name} swell tomorrow`;
    case "spot-wind-tomorrow": return `${name} wind tomorrow`;
    case "spot-tide-tomorrow": return `${name} tide tomorrow`;
  }
}

export function buildForecastBenchmarkQueries(
  spots: ForecastBenchmarkSpot[],
  spotsPerRegion = 5,
): ForecastBenchmarkQuery[] {
  const spotsByRegion = new Map<string, ForecastBenchmarkSpot[]>();
  for (const spot of spots) {
    const region = classifyForecastBenchmarkRegion(spot);
    const regionSpots = spotsByRegion.get(region) ?? [];
    regionSpots.push(spot);
    spotsByRegion.set(region, regionSpots);
  }

  const queries: ForecastBenchmarkQuery[] = [];
  for (const [region, regionSpots] of spotsByRegion) {
    const sampledSpots = [...regionSpots]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, spotsPerRegion);

    for (const spot of sampledSpots) {
      for (const queryClass of SPOT_QUERY_CLASSES) {
        queries.push({
          queryClass,
          query: spotQuery(spot, queryClass),
          spotId: spot.id,
          region,
          canonicalPath: spot.canonicalPath,
        });
      }
    }

    for (const queryClass of [
      "best-surf-region-tomorrow",
      "where-should-i-surf-region-tomorrow",
    ] as const) {
      queries.push({
        queryClass,
        query: queryClass === "best-surf-region-tomorrow"
          ? `best surf ${region} tomorrow`
          : `where should I surf ${region} tomorrow`,
        spotId: null,
        region,
        canonicalPath: sampledSpots[0]?.canonicalPath ?? null,
      });
    }
  }

  return queries;
}

function hasAny(html: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(html));
}

export function extractForecastAnswerContractFacts(
  html: string,
): ForecastAnswerContractFacts {
  const facts = {
    answerLayer: /data-testid=["']public-forecast-answer["']/.test(html),
    forecastDate: /Forecast valid at|surf forecast/i.test(html),
    surfFacts: /<dt[^>]*>Surf<\/dt>|Surf<\/h[1-6]>|Surf forecast/i.test(html),
    bestWindow: /Best window/i.test(html),
    reasoning: /Why:/i.test(html),
    freshness: /Source data updated|Quiver computed/i.test(html),
    provenance: /Contributing sources|Source data updated/i.test(html),
    score: hasAny(html, [/Score/i, /Confidence/i]) ? 1 : 0,
  };

  const passed = Object.values(facts).filter((value) => value === true || value === 1).length;
  return { ...facts, score: passed / Object.keys(facts).length };
}
