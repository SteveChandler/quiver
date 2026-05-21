import fs from "node:fs";
import path from "node:path";

import {
  buildPostHogExport,
  parsePostHogNativeRows,
  parsePostHogWebRows,
} from "../../lib/seo/agent-workflow/posthog-export";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import { loadSeoEnv } from "./load-env";

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

  const [web, native] = await Promise.all([
    hogql(`
      SELECT
        properties.pathname AS path,
        uniq(person_id) AS visitors,
        countIf(event = 'page_view' AND properties.referrer != '') / greatest(countIf(event = 'page_view'), 1) AS multi_page_rate,
        countIf(event IN ('signup_success', 'signup_form_submitted')) / greatest(uniq(person_id), 1) AS signup_rate,
        countIf(event = 'related_path_click') / greatest(countIf(event = 'page_view'), 1) AS related_path_ctr
      FROM events
      WHERE timestamp >= toDateTime('${from}')
        AND timestamp <= toDateTime('${to}')
        AND properties.$host = 'www.quiversurf.app'
        AND event IN ('page_view', 'signup_success', 'signup_form_submitted', 'related_path_click')
      GROUP BY path
      ORDER BY visitors DESC
      LIMIT 100
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
  ]);

  writeJson(buildPostHogExport(
    parsePostHogWebRows(web),
    parsePostHogNativeRows(native),
    new Date().toISOString(),
    { from, to },
  ));
}

async function hogql(query: string): Promise<unknown> {
  const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
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
