#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "./load-env.mjs";
import {
  HOGQL_NOT_BOT,
  HOGQL_NOT_EMULATOR,
  hogqlInternalPersonExclusion,
  resolveCompleteDayWindow,
  runHogQL,
  type ReportWindow,
} from "../lib/analytics/report-guards";
import {
  buildWebStickyLoopReport,
  WEB_FAMILIES,
  type WebEventFamily,
  type WebStickyEventRow,
  type WebStickyLoopReport,
  type WebStickyWindow,
} from "../lib/analytics/web-sticky-loop-v1";

config({ path: ".env.local" });
config();

const PAGE_SIZE = 10000;
const ALLOWED_EVENTS = new Set(["page_view", "nearby_beaches_viewed", "app_handoff_view", "signup_cta_view"]);
const ALLOWED_FAMILIES = new Set<string>([...WEB_FAMILIES, "app_handoff", "signup_cta"]);

interface WebStickyCliOptions {
  window: ReportWindow;
  asOf: string;
  powerDays: number;
  outputJson: string | null;
  outputMd: string | null;
}

function parsePositiveInt(value: string, flag: string): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return number;
}

export function parseCliArgs(argv: string[], now: Date = new Date()): WebStickyCliOptions {
  const values = new Map<string, string>();
  const allowed = new Set(["--start", "--end", "--days", "--tz", "--as-of", "--output-json", "--output-md", "--power-days"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || !value || value.startsWith("--") || values.has(flag)) throw new Error(`Invalid or repeated argument: ${flag}`);
    values.set(flag, value);
  }
  if (values.has("--start") !== values.has("--end")) throw new Error("--start and --end must be supplied together");
  if (values.has("--days") && values.has("--start")) throw new Error("Use --days or --start/--end");
  const asOfRaw = values.get("--as-of") ?? now.toISOString();
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(asOfRaw) || Number.isNaN(Date.parse(asOfRaw))) {
    throw new Error("--as-of must be an ISO timestamp with a UTC offset");
  }
  const asOf = new Date(asOfRaw).toISOString();
  const timeZone = values.get("--tz") ?? "America/Los_Angeles";
  if (!/^[A-Za-z_]+(?:\/[A-Za-z_+-]+)*$/.test(timeZone)) throw new Error("Invalid --tz");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new Error("Invalid --tz");
  }
  const window = resolveCompleteDayWindow({
    startDate: values.get("--start"),
    endDate: values.get("--end"),
    days: values.has("--days") ? parsePositiveInt(values.get("--days")!, "--days") : 28,
    timeZone,
    now: new Date(asOf),
  });
  if (window.end.getTime() > Date.parse(asOf)) throw new Error("Window end must be no later than --as-of");
  return {
    window,
    asOf,
    powerDays: values.has("--power-days") ? parsePositiveInt(values.get("--power-days")!, "--power-days") : 4,
    outputJson: values.get("--output-json") ?? null,
    outputMd: values.get("--output-md") ?? null,
  };
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildWebStickyHogQL(options: WebStickyCliOptions, offset: number): string {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("offset must be nonnegative");
  const tz = sqlString(options.window.timeZone);
  const start = sqlString(options.window.start.toISOString());
  const end = sqlString(options.window.end.toISOString());
  return `
    SELECT toString(person_id) AS person_id,
      properties.$session_id AS session_id,
      toString(toDate(toTimeZone(timestamp, ${tz}))) AS d,
      timestamp,
      multiIf(
        event = 'nearby_beaches_viewed', 'nearby',
        event = 'app_handoff_view', 'app_handoff',
        event = 'signup_cta_view', 'signup_cta',
        properties.surface = 'home' OR (properties.surface = 'landing-page' AND coalesce(properties.$is_identified, false)), 'home',
        properties.surface = 'landing-page', 'landing',
        properties.surface = 'map', 'map',
        properties.surface = 'beach-detail', 'beach_detail',
        properties.surface IN ('forecast', 'best-time', 'surf-report'), 'forecast',
        properties.surface IN ('cams-directory', 'surf-cams-seo'), 'cams',
        properties.surface IN ('water-temp', 'tide', 'tools-page'), 'utility',
        properties.surface IN ('city-hub', 'state-hub'), 'hubs',
        properties.surface IN ('guides-page', 'features-page', 'about-page', 'discover'), 'content',
        properties.surface = 'auth-gated', 'account',
        'other'
      ) AS family,
      properties.surface AS surface,
      coalesce(properties.$is_identified, false) AS ident,
      event,
      toString(uuid) AS uuid
    FROM events
    WHERE (event = 'page_view' OR event IN ('nearby_beaches_viewed', 'app_handoff_view', 'signup_cta_view'))
      AND properties.$lib = 'web'
      AND properties.environment = 'production'
      AND properties.$host IN ('www.quiversurf.app', 'quiversurf.app', 'go.quiversurf.app')
      AND ${HOGQL_NOT_BOT}
      AND ${HOGQL_NOT_EMULATOR}
      AND ${hogqlInternalPersonExclusion()}
      AND timestamp >= toDateTime(${start})
      AND timestamp < toDateTime(${end})
    ORDER BY person_id, timestamp, uuid
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `.trim();
}

export function parseWebStickyRows(results: unknown[][]): WebStickyEventRow[] {
  return results.map((row, index) => {
    const [personId, sessionId, localDate, timestamp, family, surface, identified, event, uuid] = row;
    if (typeof personId !== "string" || !personId || typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
      || typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp)) || typeof family !== "string" || !ALLOWED_FAMILIES.has(family)
      || typeof event !== "string" || !ALLOWED_EVENTS.has(event) || typeof uuid !== "string" || !uuid) {
      throw new Error(`Invalid PostHog row at index ${index}`);
    }
    return {
      personId,
      sessionId: typeof sessionId === "string" && sessionId ? sessionId : null,
      localDate,
      timestamp: new Date(timestamp).toISOString(),
      family: family as WebEventFamily,
      surface: typeof surface === "string" ? surface : null,
      identified: identified === true || identified === 1 || identified === "true",
      event: event as WebStickyEventRow["event"],
      uuid,
    };
  });
}

export async function loadWebStickyRows(
  options: WebStickyCliOptions,
  queryRunner: typeof runHogQL = runHogQL,
): Promise<WebStickyEventRow[]> {
  const rows: WebStickyEventRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = await queryRunner(buildWebStickyHogQL(options, offset));
    rows.push(...parseWebStickyRows(result.results));
    if (result.results.length < PAGE_SIZE) return rows;
  }
}

function markdownRate(value: { numerator: number; denominator: number; rate: number | null }): string {
  return `${value.numerator}/${value.denominator} (${value.rate === null ? "n/a" : `${(100 * value.rate).toFixed(1)}%`})`;
}

export function renderWebStickyMarkdown(report: WebStickyLoopReport): string {
  const lines = [
    "# Web sticky loops v1", "",
    `Window: ${report.window.startDate} through ${report.window.endDate} (end exclusive), ${report.window.timeZone}; as of ${report.asOf}.`,
    "", `Unit: ${report.definitions.personUnit}. Sessions: ${report.definitions.sessionUnit}.`,
    `Power users: identified people with at least ${report.definitions.powerDays} page-view days; excluded from the identified aggregate.`,
    `Exclusions: bot count unavailable (${report.excluded.bot.reason}); emulator count unavailable (${report.excluded.emulator.reason}); internal count unavailable (${report.excluded.internal.reason}).`,
    `Anonymous heavy people: ${report.anonymousHeavy.people}. Identified power users: ${report.powerUsers.length}.`,
  ];
  for (const [segmentName, segment] of Object.entries(report.segments)) {
    lines.push("", `## ${segmentName}`, "", `People: ${segment.people}; sessions: ${segment.sessions}.`, "",
      "| Family | People | Views | Sessions | Days 1 / 2 / 3 / 4-6 / 7+ | Repeat | 4+ people | Return |",
      "| --- | ---: | ---: | ---: | --- | --- | ---: | --- |");
    for (const family of WEB_FAMILIES) {
      const item = segment.families[family];
      lines.push(`| ${family} | ${item.people} | ${item.views} | ${item.sessions} | ${Object.values(item.activeDays).join(" / ")} | ${markdownRate(item.repeatRate)} | ${item.people4plus} | ${markdownRate(item.returnLoops.returnRate)} |`);
    }
    lines.push("", "Utility raw surfaces:");
    for (const [surface, item] of Object.entries(segment.utilitySurfaces)) {
      lines.push(`- ${surface}: people ${item.people}, views ${item.views}, sessions ${item.sessions}, days 1/2/3/4-6/7+ ${Object.values(item.activeDays).join("/")}, repeat ${markdownRate(item.repeatRate)}, 4+ people ${item.people4plus}, returned ${markdownRate(item.returnLoops.returnRate)}.`);
      lines.push(`  Downstream: ${Object.entries(item.downstream).filter(([target]) => target !== "utility").map(([target, value]) => `${target} ${markdownRate(value)}`).join(", ")}. First return families: ${item.returnLoops.firstReturnFamilies.map((entry) => `${entry.family} ${entry.people}`).join(", ") || "none"}.`);
    }
    lines.push("", "Loop prefixes (of all sessions):");
    for (const [prefix, value] of Object.entries(segment.loopPrefixes)) lines.push(`- ${prefix}: ${markdownRate(value)}.`);
    lines.push("", "Downstream after each family's first view in a session:");
    for (const family of WEB_FAMILIES) {
      const item = segment.families[family];
      lines.push(`- ${family}: ${Object.entries(item.downstream).filter(([target]) => target !== family).map(([target, value]) => `${target} ${markdownRate(value)}`).join(", ")}.`);
      lines.push(`  First return families: ${item.returnLoops.firstReturnFamilies.map((entry) => `${entry.family} ${entry.people}`).join(", ") || "none"}; returned people ${item.returnLoops.returnedPeople}/${item.returnLoops.people}.`);
    }
    lines.push("", `Top transitions: ${segment.topTransitions.map((item) => `${item.from} → ${item.to} ${item.count}`).join(", ") || "none"}.`);
  }
  lines.push("", "## Power users", "");
  for (const person of report.powerUsers) {
    lines.push(`- ${person.key}: days ${person.activeDays}, sessions ${person.sessions}, dates ${person.firstActiveLocalDate}–${person.lastActiveLocalDate}, prefix ${person.loopPrefixReached}/5; views ${Object.entries(person.viewsByFamily).map(([family, count]) => `${family} ${count}`).join(", ")}; transitions ${person.topTransitions.map((item) => `${item.from} → ${item.to} ${item.count}`).join(", ") || "none"}.`);
  }
  lines.push("", `Source freshness: ${Object.entries(report.sourceFreshness).map(([event, timestamp]) => `${event} ${timestamp ?? "none"}`).join(", ")}.`, "");
  return lines.join("\n");
}

function writeOutput(path: string, contents: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

export async function main(
  argv: string[] = process.argv.slice(2),
  now: Date = new Date(),
  loader: typeof loadWebStickyRows = loadWebStickyRows,
): Promise<WebStickyLoopReport> {
  const options = parseCliArgs(argv, now);
  const rows = await loader(options);
  const window: WebStickyWindow = {
    startDate: options.window.startDate,
    endDate: options.window.endDate,
    start: options.window.start.toISOString(),
    end: options.window.end.toISOString(),
    timeZone: options.window.timeZone,
  };
  const report = buildWebStickyLoopReport({ rows, window, asOf: options.asOf, powerDays: options.powerDays });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.outputJson) writeOutput(options.outputJson, json);
  else process.stdout.write(json);
  if (options.outputMd) writeOutput(options.outputMd, renderWebStickyMarkdown(report));
  return report;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
