import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(process.cwd(), '.env') });
config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });

type CoverageStatus = 'covered' | 'covered-smoke-only' | 'missing' | 'stale-weight';

export type UsageSurface = {
  id: string;
  label: string;
  weight: number;
};

export type UsageGate = {
  id: string;
  label: string;
  expectedRankMax: number;
  coverage: Exclude<CoverageStatus, 'stale-weight'>;
  source: 'web' | 'native' | 'shared';
};

export type UsageCoverageRow = UsageGate & {
  observedRank: number | null;
  observedWeight: number;
  status: CoverageStatus;
};

const USAGE_GATES: UsageGate[] = [
  { id: 'home', label: 'Home', expectedRankMax: 3, coverage: 'covered', source: 'shared' },
  { id: 'beach_detail', label: 'BeachDetail / beach pages', expectedRankMax: 3, coverage: 'covered', source: 'shared' },
  { id: 'explore_map_search', label: 'Explore / Map / search', expectedRankMax: 6, coverage: 'covered', source: 'shared' },
  { id: 'session_log', label: 'Session log / rating', expectedRankMax: 8, coverage: 'covered', source: 'shared' },
  { id: 'profile_you', label: 'You / Profile', expectedRankMax: 6, coverage: 'covered-smoke-only', source: 'native' },
  { id: 'community', label: 'Community', expectedRankMax: 10, coverage: 'covered-smoke-only', source: 'native' },
  { id: 'share', label: 'Share', expectedRankMax: 10, coverage: 'covered', source: 'shared' },
  { id: 'paywall', label: 'Paywall entry', expectedRankMax: 10, coverage: 'covered-smoke-only', source: 'native' },
];

function normalizeSurfaceId(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

  if (/^home|oracle_home|home_hero/.test(normalized)) return 'home';
  if (/beach|spot|forecast/.test(normalized)) return 'beach_detail';
  if (/explore|map|search|nearby/.test(normalized)) return 'explore_map_search';
  if (/session_log|sessionform|session_form|record/.test(normalized)) return 'session_log';
  if (/you|profile|userprofile|settings/.test(normalized)) return 'profile_you';
  if (/community|feed|follow/.test(normalized)) return 'community';
  if (/share|invite/.test(normalized)) return 'share';
  if (/paywall|purchase|subscription|pro/.test(normalized)) return 'paywall';

  return null;
}

export function classifyUsageCoverage(
  observedSurfaces: UsageSurface[],
  gates: UsageGate[] = USAGE_GATES,
): UsageCoverageRow[] {
  const ranked = new Map<string, { rank: number; weight: number }>();

  observedSurfaces
    .slice()
    .sort((left, right) => right.weight - left.weight)
    .forEach((surface, index) => {
      const id = normalizeSurfaceId(surface.id) ?? normalizeSurfaceId(surface.label);
      if (!id || ranked.has(id)) return;
      ranked.set(id, { rank: index + 1, weight: surface.weight });
    });

  return gates.map((gate) => {
    const observed = ranked.get(gate.id);
    if (!observed) {
      return {
        ...gate,
        observedRank: null,
        observedWeight: 0,
        status: 'missing',
      };
    }

    const isStale = observed.rank > gate.expectedRankMax;
    const status: CoverageStatus = isStale ? 'stale-weight' : gate.coverage;

    return {
      ...gate,
      observedRank: observed.rank,
      observedWeight: observed.weight,
      status,
    };
  });
}

async function fetchPostHogSurfaces(days: 7 | 28): Promise<UsageSurface[]> {
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY ?? process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST ?? 'https://us.posthog.com';

  if (!projectId || !apiKey) {
    throw new Error('Set POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY for live PostHog usage drift');
  }

  const query = `
    SELECT
      coalesce(properties.$screen_name, properties.screen_name, properties.screen, event) AS surface,
      count() AS events
    FROM events
    WHERE timestamp >= now() - interval ${days} day
      AND (
        properties.$app_namespace IS NOT NULL
        OR event IN ('beach_view', 'forecast_interaction', 'map_interaction', 'beach_search', 'session_log_start', 'share_completed', 'paywall_opened')
      )
      AND coalesce(properties.$is_emulator, false) = false
    GROUP BY surface
    ORDER BY events DESC
    LIMIT 50
  `;

  const response = await fetch(`${host.replace(/\/$/, '')}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  });

  if (!response.ok) {
    throw new Error(`PostHog query failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as { results?: Array<[string | null, number | string]> };
  return (payload.results ?? []).map(([surface, events]) => ({
    id: surface ?? 'unknown',
    label: surface ?? 'Unknown',
    weight: Number(events) || 0,
  }));
}

function printRows(title: string, rows: UsageCoverageRow[]): void {
  console.log(`\n${title}`);
  console.log('status             rank  events  surface');
  for (const row of rows) {
    const rank = row.observedRank === null ? '-' : String(row.observedRank);
    console.log(`${row.status.padEnd(18)} ${rank.padStart(4)}  ${String(row.observedWeight).padStart(6)}  ${row.label}`);
  }
}

async function main(): Promise<void> {
  console.log('Usage coverage drift report');
  console.log('Mode: read-only, non-blocking');
  console.log('Note: raw Vercel traffic is intentionally excluded from weighting.');

  const blockers: string[] = [];

  for (const days of [7, 28] as const) {
    try {
      const surfaces = await fetchPostHogSurfaces(days);
      printRows(`${days}d PostHog/Supabase-owned behavior proxy`, classifyUsageCoverage(surfaces));
    } catch (error) {
      blockers.push(`${days}d usage source unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (blockers.length > 0) {
    console.log('\nBlockers');
    for (const blocker of blockers) console.log(`- ${blocker}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 0;
  });
}
