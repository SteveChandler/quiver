import { createHash } from "node:crypto";

export const WEB_STICKY_LOOP_SCHEMA_VERSION = "web_sticky_loop.v1" as const;

export const WEB_FAMILIES = [
  "home", "landing", "map", "beach_detail", "forecast", "cams", "utility",
  "hubs", "content", "account", "other", "nearby",
] as const;
export type WebFamily = (typeof WEB_FAMILIES)[number];
export type WebEventFamily = WebFamily | "app_handoff" | "signup_cta";
const LOOP_FAMILIES = ["home", "map", "beach_detail", "forecast", "nearby"] as const;
const INTENT_FAMILIES = ["app_handoff", "signup_cta"] as const;
const UTILITY_SURFACES = ["water-temp", "tide", "tools-page"] as const;

export interface WebStickyEventRow {
  personId: string;
  sessionId: string | null;
  localDate: string;
  timestamp: string;
  family: WebEventFamily;
  surface: string | null;
  identified: boolean;
  event: "page_view" | "nearby_beaches_viewed" | "app_handoff_view" | "signup_cta_view";
  uuid: string;
}

export interface WebStickyWindow {
  startDate: string;
  endDate: string;
  start: string;
  end: string;
  timeZone: string;
}

interface Rate {
  numerator: number;
  denominator: number;
  rate: number | null;
}

interface FamilyMetrics {
  people: number;
  views: number;
  sessions: number;
  activeDays: Record<"1" | "2" | "3" | "4-6" | "7+", number>;
  repeatPeople: number;
  repeatRate: Rate;
  people4plus: number;
  downstream: Record<WebEventFamily, Rate>;
  returnLoops: { people: number; returnedPeople: number; returnRate: Rate; firstReturnFamilies: Array<{ family: WebFamily; people: number }> };
}

export interface SegmentMetrics {
  people: number;
  sessions: number;
  families: Record<WebFamily, FamilyMetrics>;
  utilitySurfaces: Record<(typeof UTILITY_SURFACES)[number], FamilyMetrics>;
  loopPrefixes: Record<"home_map" | "home_map_beach_detail" | "home_map_beach_detail_forecast" | "home_map_beach_detail_forecast_nearby", Rate>;
  topTransitions: Array<{ from: WebFamily; to: WebFamily; count: number }>;
}

export interface PowerUserMetrics {
  key: string;
  activeDays: number;
  sessions: number;
  viewsByFamily: Record<WebFamily, number>;
  topTransitions: SegmentMetrics["topTransitions"];
  loopPrefixReached: number;
  firstActiveLocalDate: string;
  lastActiveLocalDate: string;
}

export interface WebStickyLoopReport {
  schemaVersion: typeof WEB_STICKY_LOOP_SCHEMA_VERSION;
  asOf: string;
  window: WebStickyWindow;
  definitions: { powerDays: number; personUnit: string; sessionUnit: string; sequenceUnit: string };
  sourceFreshness: Record<WebStickyEventRow["event"], string | null>;
  excluded: { bot: { count: null; reason: string }; emulator: { count: null; reason: string }; internal: { count: null; reason: string } };
  anonymousHeavy: { people: number };
  segments: { anonymous: SegmentMetrics; identified: SegmentMetrics };
  powerUsers: PowerUserMetrics[];
}

interface BuildWebStickyLoopInput {
  rows: WebStickyEventRow[];
  window: WebStickyWindow;
  asOf: string;
  powerDays?: number;
}

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, rate: denominator === 0 ? null : numerator / denominator };
}

function isFamily(value: WebEventFamily): value is WebFamily {
  return !INTENT_FAMILIES.some((intent) => intent === value);
}

function emptyFamilyMetrics(): FamilyMetrics {
  return {
    people: 0, views: 0, sessions: 0,
    activeDays: { "1": 0, "2": 0, "3": 0, "4-6": 0, "7+": 0 },
    repeatPeople: 0, repeatRate: rate(0, 0), people4plus: 0,
    downstream: Object.fromEntries([...WEB_FAMILIES, ...INTENT_FAMILIES].map((family) => [family, rate(0, 0)])) as Record<WebEventFamily, Rate>,
    returnLoops: { people: 0, returnedPeople: 0, returnRate: rate(0, 0), firstReturnFamilies: [] },
  };
}

function sessionGroups(rows: WebStickyEventRow[]): WebStickyEventRow[][] {
  const groups = new Map<string, WebStickyEventRow[]>();
  for (const row of rows) {
    if (!row.sessionId) continue;
    const key = `${row.personId}\u0000${row.sessionId}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function orderedFamilies(rows: WebStickyEventRow[]): WebFamily[] {
  const result: WebFamily[] = [];
  for (const row of rows) {
    if (!isFamily(row.family) || result.at(-1) === row.family) continue;
    result.push(row.family);
  }
  return result;
}

function prefixReached(sequence: readonly WebFamily[]): number {
  let index = 0;
  for (const family of sequence) {
    if (family === LOOP_FAMILIES[index]) index += 1;
    if (index === LOOP_FAMILIES.length) break;
  }
  return index;
}

function transitions(groups: WebStickyEventRow[][]): SegmentMetrics["topTransitions"] {
  const counts = new Map<string, number>();
  for (const group of groups) {
    const sequence = orderedFamilies(group);
    for (let index = 1; index < sequence.length; index += 1) {
      const key = `${sequence[index - 1]}\u0000${sequence[index]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([key, count]) => {
    const [from, to] = key.split("\u0000") as [WebFamily, WebFamily];
    return { from, to, count };
  }).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).slice(0, 15);
}

function familyMetrics(
  rows: WebStickyEventRow[],
  groups: WebStickyEventRow[][],
  personRowsById: Map<string, WebStickyEventRow[]>,
  family: WebFamily,
  surface?: string,
): FamilyMetrics {
  const metrics = emptyFamilyMetrics();
  const matches = (row: WebStickyEventRow): boolean => row.family === family && (!surface || row.surface === surface);
  const byPerson = new Map<string, Set<string>>();
  const matchingRows = rows.filter(matches);
  metrics.views = matchingRows.length;
  for (const row of matchingRows) {
    const days = byPerson.get(row.personId) ?? new Set<string>();
    days.add(row.localDate);
    byPerson.set(row.personId, days);
  }
  metrics.people = byPerson.size;
  for (const days of byPerson.values()) {
    const count = days.size;
    const bucket = count >= 7 ? "7+" : count >= 4 ? "4-6" : String(count) as "1" | "2" | "3";
    metrics.activeDays[bucket] += 1;
    if (count >= 2) metrics.repeatPeople += 1;
    if (count >= 4) metrics.people4plus += 1;
  }
  metrics.repeatRate = rate(metrics.repeatPeople, metrics.people);

  const familyGroups = groups.filter((group) => group.some(matches));
  metrics.sessions = familyGroups.length;
  const destinations = [...WEB_FAMILIES, ...INTENT_FAMILIES];
  for (const destination of destinations) {
    if (destination === family) continue;
    let numerator = 0;
    for (const group of familyGroups) {
      const first = group.find(matches);
      if (first && group.some((row) => row.family === destination && Date.parse(row.timestamp) > Date.parse(first.timestamp))) numerator += 1;
    }
    metrics.downstream[destination] = rate(numerator, familyGroups.length);
  }
  metrics.downstream[family] = rate(0, familyGroups.length);

  const returned = new Map<WebFamily, number>();
  let firstDayPeople = 0;
  for (const [personId, days] of byPerson) {
    const personRows = (personRowsById.get(personId) ?? []).filter((row) => isFamily(row.family));
    const firstDay = personRows[0]?.localDate;
    if (!firstDay || !days.has(firstDay)) continue;
    firstDayPeople += 1;
    const firstReturn = personRows.find((row) => row.localDate > firstDay);
    if (!firstReturn) continue;
    returned.set(firstReturn.family as WebFamily, (returned.get(firstReturn.family as WebFamily) ?? 0) + 1);
  }
  metrics.returnLoops.people = firstDayPeople;
  metrics.returnLoops.returnedPeople = [...returned.values()].reduce((sum, count) => sum + count, 0);
  metrics.returnLoops.returnRate = rate(metrics.returnLoops.returnedPeople, firstDayPeople);
  metrics.returnLoops.firstReturnFamilies = [...returned.entries()].map(([name, people]) => ({ family: name, people }))
    .sort((a, b) => b.people - a.people || a.family.localeCompare(b.family)).slice(0, 5);
  return metrics;
}

function segmentMetrics(rows: WebStickyEventRow[]): SegmentMetrics {
  const groups = sessionGroups(rows);
  const personRowsById = new Map<string, WebStickyEventRow[]>();
  for (const row of rows) {
    const personRows = personRowsById.get(row.personId) ?? [];
    personRows.push(row);
    personRowsById.set(row.personId, personRows);
  }
  const families = Object.fromEntries(WEB_FAMILIES.map((family) => [family, familyMetrics(rows, groups, personRowsById, family)])) as Record<WebFamily, FamilyMetrics>;
  const utilitySurfaces = Object.fromEntries(UTILITY_SURFACES.map((surface) => [surface, familyMetrics(rows, groups, personRowsById, "utility", surface)])) as SegmentMetrics["utilitySurfaces"];
  const prefixNames = ["home_map", "home_map_beach_detail", "home_map_beach_detail_forecast", "home_map_beach_detail_forecast_nearby"] as const;
  const loopPrefixes = Object.fromEntries(prefixNames.map((name, index) => [
    name, rate(groups.filter((group) => prefixReached(orderedFamilies(group)) >= index + 2).length, groups.length),
  ])) as SegmentMetrics["loopPrefixes"];
  return {
    people: new Set(rows.map((row) => row.personId)).size,
    sessions: groups.length,
    families,
    utilitySurfaces,
    loopPrefixes,
    topTransitions: transitions(groups),
  };
}

function powerUserMetrics(personId: string, rows: WebStickyEventRow[]): PowerUserMetrics {
  const groups = sessionGroups(rows);
  const pageRows = rows.filter((row) => row.event === "page_view");
  const dates = [...new Set(pageRows.map((row) => row.localDate))].sort();
  const viewsByFamily = Object.fromEntries(WEB_FAMILIES.map((family) => [family, rows.filter((row) => row.family === family).length])) as Record<WebFamily, number>;
  return {
    key: createHash("sha256").update(personId).digest("hex").slice(0, 10),
    activeDays: dates.length,
    sessions: groups.length,
    viewsByFamily,
    topTransitions: transitions(groups),
    loopPrefixReached: Math.max(0, ...groups.map((group) => prefixReached(orderedFamilies(group)))),
    firstActiveLocalDate: dates[0],
    lastActiveLocalDate: dates.at(-1) as string,
  };
}

export function buildWebStickyLoopReport(input: BuildWebStickyLoopInput): WebStickyLoopReport {
  const powerDays = input.powerDays ?? 4;
  if (!Number.isInteger(powerDays) || powerDays < 1) throw new Error("powerDays must be a positive integer");
  const rows = [...input.rows].sort((a, b) => a.personId.localeCompare(b.personId) || Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.uuid.localeCompare(b.uuid));
  const byPerson = new Map<string, WebStickyEventRow[]>();
  const freshness: WebStickyLoopReport["sourceFreshness"] = {
    page_view: null, nearby_beaches_viewed: null, app_handoff_view: null, signup_cta_view: null,
  };
  for (const row of rows) {
    const personRows = byPerson.get(row.personId) ?? [];
    personRows.push(row);
    byPerson.set(row.personId, personRows);
    if (!freshness[row.event] || row.timestamp > freshness[row.event]!) freshness[row.event] = row.timestamp;
  }
  const anonymous: WebStickyEventRow[] = [];
  const identified: WebStickyEventRow[] = [];
  const powerUsers: PowerUserMetrics[] = [];
  let anonymousHeavy = 0;
  for (const [personId, personRows] of byPerson) {
    const activeDays = new Set(personRows.filter((row) => row.event === "page_view").map((row) => row.localDate)).size;
    if (!personRows.some((row) => row.identified)) {
      anonymous.push(...personRows);
      if (activeDays >= powerDays) anonymousHeavy += 1;
    } else if (activeDays >= powerDays) {
      powerUsers.push(powerUserMetrics(personId, personRows));
    } else {
      identified.push(...personRows);
    }
  }
  powerUsers.sort((a, b) => b.activeDays - a.activeDays || a.key.localeCompare(b.key));
  return {
    schemaVersion: WEB_STICKY_LOOP_SCHEMA_VERSION,
    asOf: input.asOf,
    window: input.window,
    definitions: {
      powerDays,
      personUnit: "PostHog person_id; anonymous continuity is cookie-level and repeat is a lower bound",
      sessionUnit: "person_id plus nonempty $session_id",
      sequenceUnit: "ordered family changes within a session; loop prefixes are ordered subsequences",
    },
    sourceFreshness: freshness,
    excluded: {
      bot: { count: null, reason: "Filtered at ingest for mirrored page_view and by HogQL bot predicate; excluded population is not available from eligible rows" },
      emulator: { count: null, reason: "Filtered by HogQL emulator predicate; excluded population is not available from eligible rows" },
      internal: { count: null, reason: "Filtered by PostHog internal cohort and known profile IDs; excluded population is not available from eligible rows" },
    },
    anonymousHeavy: { people: anonymousHeavy },
    segments: { anonymous: segmentMetrics(anonymous), identified: segmentMetrics(identified) },
    powerUsers,
  };
}
