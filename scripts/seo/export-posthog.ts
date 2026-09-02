import fs from "node:fs";
import path from "node:path";

import {
  buildPostHogExport,
  computePostHogWebRows,
  parsePostHogWebEvents,
  parsePostHogNativeRows,
} from "../../lib/seo/agent-workflow/posthog-export";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { loadSeoEnv } from "./load-env";
import { fetchWithRetry, isRemoteFetchError, normalizeFetchError } from "./resilient-fetch";

loadSeoEnv();

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("POSTHOG-EXPORT.json", currentAuditDate());
const projectId = process.env.POSTHOG_PROJECT_ID;
const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const host = normalizeHost(
  process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
);
const { from, to } = defaultDateRange();

void main();

async function main(): Promise<void> {
  if (!projectId || !apiKey) {
    writeJson(buildPostHogExport([], [], new Date().toISOString(), { from, to }, [
      "POSTHOG_PROJECT_ID",
      "POSTHOG_PERSONAL_API_KEY",
    ].filter((name) => !process.env[name])));
    return;
  }

  const exportData = await Promise.all([
    hogql(`
      SELECT
        event,
        timestamp,
        coalesce(nullIf(properties.browser_session_id, ''), nullIf(properties.$session_id, '')) AS session_key,
        properties.pathname AS path
      FROM events
      WHERE timestamp >= toDateTime('${from}')
        AND timestamp <= toDateTime('${to}')
        AND properties.$host = 'www.quiversurf.app'
        AND event IN ('page_view', 'signup_success')
      ORDER BY timestamp ASC
      LIMIT 10000
    `),
    hogql(`
      SELECT
        coalesce(properties._platform, properties.platform, 'unknown') AS platform,
        event,
        count() AS count
      FROM events
      WHERE timestamp >= toDateTime('${from}')
        AND timestamp <= toDateTime('${to}')
        AND coalesce(properties._platform, properties.platform, '') IN ('native-ios', 'native-android')
        AND (properties.$is_emulator IS NULL OR properties.$is_emulator = false)
        AND properties.$app_namespace IS NOT NULL
        AND coalesce(properties.environment, 'production') NOT IN ('test', 'local', 'development')
        AND event IN (
          'onboarding_video_started',
          'onboarding_step_viewed',
          'onboarding_completed',
          'paywall_opened',
          'paywall_purchase_started',
          'paywall_purchase_success',
          'session_log_start',
          'first_session_logged',
          'session_log_submit',
          'share_completed'
        )
      GROUP BY platform, event
      ORDER BY platform ASC, count DESC
    `),
  ]).then(([web, native]) => buildPostHogExport(
    computePostHogWebRows(parsePostHogWebEvents(web)),
    parsePostHogNativeRows(native),
    new Date().toISOString(),
    { from, to },
  )).catch((error) => {
    if (!isRemoteFetchError(error)) throw error;
    return buildPostHogExport([], [], new Date().toISOString(), { from, to }, [
      `PostHog export fetch failed: ${normalizeFetchError(error)}`,
    ]);
  });

  writeJson(exportData);
}

async function hogql(query: string): Promise<unknown> {
  const response = await fetchWithRetry(`${host}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!response.ok) throw new Error(`PostHog query failed: ${response.status}`);
  return response.json();
}

function normalizeHost(value: string): string {
  if (value.startsWith("/")) return "https://us.posthog.com";
  return value.replace(/\/$/, "");
}

function defaultDateRange(): { from: string; to: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function writeJson(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
