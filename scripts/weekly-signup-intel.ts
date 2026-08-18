/**
 * Weekly signup intelligence: turns one week of `user_events` into a dated
 * decision document instead of chat output.
 *
 * The founder-outreach routine personalizes from four event types. That is the
 * right scope for an email, and the wrong scope for a verdict: a user can fire
 * fifty native events and still read as "no activity" because none of them are
 * one of those four. This script reads the whole stream, so "no activity" means
 * the account genuinely never produced an event.
 *
 * Output is a markdown report ending in an ACTION LIST, where every line is
 * either an email to send or a fix to apply. Nothing here sends, commits, or
 * mutates anything.
 *
 * Usage: npx tsx scripts/weekly-signup-intel.ts [--days 7] [--date YYYY-MM-DD]
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local)"
  );
}

const PAGE_SIZE = 1000;
const IN_CHUNK_SIZE = 100;
const APPLE_RELAY_DOMAIN = "@privaterelay.appleid.com";
const TEST_EMAIL_PATTERNS = [/@example\.invalid$/i, /@quiversurf\.test$/i, /^codex-/i, /^e2e-/i];
const OUTPUT_DIR = path.join("docs", "growth", "signup-intel");

/**
 * Friction gates. A gate fires an [APPLY FIX] line only when the ratio crosses
 * the threshold AND the numerator clears `minCount`, so a 1-of-2 week cannot
 * manufacture a priority. Thresholds live here so they are reviewable in a diff
 * rather than buried in prose.
 */
type GateMode =
  /** failures ÷ baseline, where baseline is a separate population. */
  | "ratio"
  /** failures ÷ (failures + baseline), where the two together are the whole population. */
  | "share"
  /** (failures − resolutions) ÷ failures, for opens that never reached an outcome. */
  | "unresolved";

type FrictionGate = {
  id: string;
  label: string;
  failEvents: string[];
  baseEvents: string[];
  mode: GateMode;
  threshold: number;
  minCount: number;
  owner: string;
  fix: string;
  /** Drops benign outcomes that share the event name, e.g. a user cancelling an OAuth sheet. */
  excludeWhen?: { key: string; values: string[] };
  /** Metadata keys summarized so the report names the failing thing, not just the count. */
  reasonKeys?: string[];
};

const FRICTION_GATES: FrictionGate[] = [
  {
    id: "session-log-validation",
    label: "Session logs rejected by validation",
    failEvents: ["session_log_validation_failed"],
    baseEvents: ["session_log_submit"],
    mode: "ratio",
    threshold: 0.5,
    minCount: 5,
    owner: "quiver-native/src/features/session-log + components/session-forms/",
    fix: "Read the `field`/`reason` in the failing event metadata and make the blocked field either optional or self-correcting. Logging is the habit the whole product depends on.",
    reasonKeys: ["validation_errors", "validation_first_field", "entry_point"],
  },
  {
    id: "auth-modal-abandon",
    label: "Auth modal closed without acting",
    failEvents: ["auth_modal_closed_without_action"],
    baseEvents: ["auth_modal_opened"],
    mode: "ratio",
    threshold: 0.4,
    minCount: 5,
    owner: "components/auth/ (web) + quiver-native auth modal",
    fix: "Check whether the modal is opening unprompted. An unprompted modal is a bounce, not a decision.",
    reasonKeys: ["source", "entry_point"],
  },
  {
    id: "auth-failure",
    label: "Auth attempts that errored",
    failEvents: ["auth_failed"],
    baseEvents: ["login_form_submitted", "signup_form_submitted"],
    mode: "ratio",
    threshold: 0.25,
    minCount: 3,
    owner: "auth callback + Supabase auth config",
    fix: "Group the failures by `reason`. A single dominant reason is a bug, a spread is user error.",
    excludeWhen: { key: "reason", values: ["cancelled", "canceled", "user_cancelled"] },
    reasonKeys: ["reason", "provider", "mode"],
  },
  {
    id: "push-permission",
    label: "Push permission denied",
    failEvents: ["push_permission_denied"],
    baseEvents: ["push_device_registered"],
    mode: "share",
    threshold: 0.25,
    minCount: 5,
    owner: "quiver-native push priming",
    fix: "Denials are permanent per install. Confirm the OS prompt is gated behind a primer that names the payoff (alerts for your break).",
    reasonKeys: ["source", "stage", "entry_point"],
  },
  {
    id: "paywall-stall",
    label: "Paywall opened with no outcome",
    failEvents: ["paywall_opened"],
    baseEvents: ["paywall_dismissed", "onboarding_paywall_skipped", "paywall_purchase_success"],
    mode: "unresolved",
    threshold: 0.4,
    minCount: 4,
    owner: "quiver-native paywall + RevenueCat wiring",
    fix: "Opens with no dismiss, skip, or purchase mean users are killing the app on the paywall. Verify the skip control is reachable on the smallest supported screen.",
    reasonKeys: ["source", "entry_point"],
  },
];

/**
 * Two separate funnels. Acquisition steps are one narrowing population and can
 * be read as conversion. Activation steps come from the whole user base, not
 * this week's signups, so they are reported against their own first step.
 */
const ACQUISITION_STEPS: Array<{ event: string; label: string }> = [
  { event: "signup_cta_view", label: "Saw a signup CTA" },
  { event: "signup_cta_click", label: "Tapped a signup CTA" },
  { event: "signup_started", label: "Started signup" },
  { event: "signup_success", label: "Account created" },
  { event: "first_beach_view_post_signup", label: "Viewed a beach after signup" },
];

const ACTIVATION_STEPS: Array<{ event: string; label: string }> = [
  { event: "session_log_start", label: "Started a session log" },
  { event: "session_log_submit", label: "Submitted the form" },
  { event: "session_created", label: "Session saved" },
];

const ERROR_EVENTS = [
  "client_error",
  "map_load_failed",
  "custom_spot_failed",
  "push_token_fetch_failed",
  "push_device_registration_failed",
  "session_log_validation_failed",
];

type EventRow = {
  user_id: string | null;
  event_type: string;
  beach_id: string | null;
  metadata: unknown;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  created_at: string;
  home_beach_id: string | null;
};

type Verdict =
  | "never-signed-in"
  | "bounced"
  | "explored"
  | "logged-session";

type CohortMember = {
  email: string;
  displayName: string | null;
  createdAt: string;
  platform: string;
  eventCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  spanMinutes: number | null;
  topEvents: Array<[string, number]>;
  frictionHits: string[];
  verdict: Verdict;
  emailVersion: "A" | "B" | "C" | "D";
  isRelay: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

async function fetchAllPages<T>(
  label: string,
  page: (from: number, to: number) => PageResult<T>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label} fetch failed: ${error.message}`);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

/**
 * No platform column exists on `user_events`. Native builds stamp `app_build`
 * and Expo launch keys into metadata; nothing on web does. Treated as a
 * heuristic and labelled as one in the report.
 */
function inferPlatform(events: EventRow[]): string {
  let native = 0;
  let web = 0;
  for (const event of events) {
    const meta = asRecord(event.metadata);
    if ("app_build" in meta || "expo_is_emergency_launch" in meta) native += 1;
    else web += 1;
  }
  if (native === 0 && web === 0) return "none";
  if (native > 0 && web > 0) return "native + web";
  return native > 0 ? "native" : "web";
}

function classify(events: EventRow[], completedSessions: number): Verdict {
  if (events.length === 0) return "never-signed-in";
  if (completedSessions > 0) return "logged-session";
  const meaningful = events.filter((event) =>
    ["beach_view", "map_interaction", "forecast_interaction", "session_log_start", "tab_view"].includes(
      event.event_type
    )
  );
  return meaningful.length >= 3 ? "explored" : "bounced";
}

/** Mirrors the outreach routine's signal order so the report and the drafts agree. */
function pickEmailVersion(events: EventRow[], hasBeachSignal: boolean, verdict: Verdict): "A" | "B" | "C" | "D" {
  const types = new Set(events.map((event) => event.event_type));
  if (types.has("session_spot_search_no_results")) return "A";
  if (types.has("session_log_abandon")) return "B";
  if (hasBeachSignal && verdict !== "never-signed-in") return "C";
  return "D";
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return "n/a";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

async function fetchEvents(
  supabase: SupabaseClient,
  cutoffIso: string
): Promise<EventRow[]> {
  return fetchAllPages<EventRow>("user_events", (from, to) =>
    supabase
      .from("user_events")
      .select("user_id, event_type, beach_id, metadata, created_at")
      .gte("created_at", cutoffIso)
      .not("bot_flagged", "is", true)
      .order("created_at")
      .range(from, to)
  );
}

async function main(): Promise<void> {
  const days = Number(getFlag("--days") ?? "7");
  const reportDate = getFlag("--date") ?? new Date().toISOString().slice(0, 10);
  const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const profileRows = await fetchAllPages<ProfileRow>("profiles", (from, to) =>
    supabase
      .from("profiles")
      .select("id, email, display_name, full_name, created_at, home_beach_id")
      .eq("is_mock", false)
      .gte("created_at", cutoffIso)
      .order("created_at")
      .range(from, to)
  );

  const profiles = profileRows
    .filter((row): row is ProfileRow & { email: string } => Boolean(row.email))
    .filter((row) => !TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(row.email)));

  const events = await fetchEvents(supabase, cutoffIso);

  const newUserIds = new Set(profiles.map((row) => row.id));
  const sessionRows: Array<{ user_id: string; created_at: string }> = [];
  for (const ids of chunk([...newUserIds], IN_CHUNK_SIZE)) {
    const batch = await fetchAllPages<{ user_id: string; created_at: string }>("sessions", (from, to) =>
      supabase
        .from("sessions")
        .select("user_id, created_at")
        .in("user_id", ids)
        .eq("status", "completed")
        .is("deleted_at", null)
        .gte("created_at", cutoffIso)
        .range(from, to)
    );
    sessionRows.push(...batch);
  }

  const eventCounts = new Map<string, number>();
  for (const event of events) {
    eventCounts.set(event.event_type, (eventCounts.get(event.event_type) ?? 0) + 1);
  }

  const eventsByUser = new Map<string, EventRow[]>();
  for (const event of events) {
    if (!event.user_id || !newUserIds.has(event.user_id)) continue;
    const bucket = eventsByUser.get(event.user_id);
    if (bucket) bucket.push(event);
    else eventsByUser.set(event.user_id, [event]);
  }

  const cohort: CohortMember[] = profiles.map((row) => {
    const userEvents = (eventsByUser.get(row.id) ?? []).filter(
      (event) => event.created_at >= row.created_at
    );
    const completed = sessionRows.filter(
      (session) => session.user_id === row.id && session.created_at >= row.created_at
    ).length;

    const perType = new Map<string, number>();
    for (const event of userEvents) perType.set(event.event_type, (perType.get(event.event_type) ?? 0) + 1);

    const first = userEvents[0]?.created_at ?? null;
    const last = userEvents[userEvents.length - 1]?.created_at ?? null;
    const spanMinutes =
      first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 60000) : null;

    const verdict = classify(userEvents, completed);
    const hasBeachSignal =
      Boolean(row.home_beach_id) || userEvents.some((event) => event.event_type === "beach_view");

    return {
      email: row.email,
      displayName: row.display_name ?? row.full_name ?? null,
      createdAt: row.created_at,
      platform: inferPlatform(userEvents),
      eventCount: userEvents.length,
      firstEventAt: first,
      lastEventAt: last,
      spanMinutes,
      topEvents: [...perType].sort((a, b) => b[1] - a[1]).slice(0, 4),
      frictionHits: FRICTION_GATES.filter((gate) => perType.has(gate.failEvent)).map((gate) => gate.id),
      verdict,
      emailVersion: pickEmailVersion(userEvents, hasBeachSignal, verdict),
      isRelay: row.email.toLowerCase().endsWith(APPLE_RELAY_DOMAIN),
    };
  });

  const sumEvents = (types: string[]): number =>
    types.reduce((total, type) => total + (eventCounts.get(type) ?? 0), 0);

  const firedGates = FRICTION_GATES.map((gate) => {
    const failRows = events.filter((event) => {
      if (!gate.failEvents.includes(event.event_type)) return false;
      if (!gate.excludeWhen) return true;
      const value = asRecord(event.metadata)[gate.excludeWhen.key];
      return !(typeof value === "string" && gate.excludeWhen.values.includes(value));
    });

    const distinctUsers = new Set(failRows.map((event) => event.user_id).filter(Boolean)).size;
    const flows = new Map<string, number>();
    for (const event of failRows) {
      const flowId = asRecord(event.metadata).flow_id;
      if (typeof flowId === "string") flows.set(flowId, (flows.get(flowId) ?? 0) + 1);
    }
    const topFlow = [...flows].sort((a, b) => b[1] - a[1])[0] ?? null;

    const reasons = new Map<string, number>();
    for (const event of failRows) {
      const meta = asRecord(event.metadata);
      for (const key of gate.reasonKeys ?? []) {
        const raw = meta[key];
        if (raw === undefined || raw === null) continue;
        const label = Array.isArray(raw) ? raw.join("+") : String(raw);
        reasons.set(`${key}=${label}`, (reasons.get(`${key}=${label}`) ?? 0) + 1);
      }
    }

    const fails = failRows.length;
    const base = sumEvents(gate.baseEvents);
    const ratio = (() => {
      if (gate.mode === "share") return fails + base === 0 ? 0 : fails / (fails + base);
      if (gate.mode === "unresolved") return fails === 0 ? 0 : Math.max(0, fails - base) / fails;
      return base === 0 ? (fails > 0 ? Infinity : 0) : fails / base;
    })();
    return {
      gate,
      fails,
      base,
      ratio,
      distinctUsers,
      distinctFlows: flows.size,
      topFlowShare: topFlow && fails > 0 ? topFlow[1] / fails : 0,
      topReasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 3),
      fired: fails >= gate.minCount && ratio >= gate.threshold,
    };
  });

  const errorSurfaces = new Map<string, number>();
  for (const event of events) {
    if (!ERROR_EVENTS.includes(event.event_type)) continue;
    const meta = asRecord(event.metadata);
    // Native errors label themselves with feature/operation; web uses surface/source.
    const feature = typeof meta.feature === "string" ? meta.feature : null;
    const operation = typeof meta.operation === "string" ? meta.operation : null;
    const surface =
      (feature && operation ? `${feature}/${operation}` : null) ||
      feature ||
      (typeof meta.endpoint === "string" && meta.endpoint) ||
      (typeof meta.surface === "string" && meta.surface) ||
      (typeof meta.source === "string" && meta.source) ||
      (typeof meta.error_name === "string" && meta.error_name) ||
      (typeof meta.validation_first_field === "string" && meta.validation_first_field) ||
      (typeof meta.reason === "string" && meta.reason) ||
      (typeof meta.message === "string" && meta.message.slice(0, 60)) ||
      "(unlabelled)";
    const key = `${event.event_type} · ${surface}`;
    errorSurfaces.set(key, (errorSurfaces.get(key) ?? 0) + 1);
  }

  const emptyStates = new Map<string, number>();
  for (const event of events) {
    if (event.event_type !== "empty_state_shown") continue;
    const surface = asRecord(event.metadata).surface;
    const key = typeof surface === "string" ? surface : "(unlabelled)";
    emptyStates.set(key, (emptyStates.get(key) ?? 0) + 1);
  }

  const lines: string[] = [];
  lines.push(`# Weekly Signup Intel — ${reportDate}`);
  lines.push("");
  lines.push(
    `Window: last ${days} days (since ${cutoffIso}). ${events.length} events across ${eventCounts.size} distinct types. ${profiles.length} new accounts.`
  );
  lines.push("");
  lines.push(
    "Platform is inferred from native-only metadata keys (`app_build`, `expo_is_emergency_launch`) because `user_events` has no platform column. Treat it as a heuristic."
  );
  lines.push("");

  lines.push("## 1. Signup cohort");
  lines.push("");
  lines.push("| Account | Platform | Events | Span | Verdict | Email |");
  lines.push("| --- | --- | ---: | ---: | --- | --- |");
  for (const member of cohort) {
    const span = member.spanMinutes === null ? "—" : `${member.spanMinutes}m`;
    const relay = member.isRelay ? " *(relay)*" : "";
    lines.push(
      `| ${member.email}${relay} | ${member.platform} | ${member.eventCount} | ${span} | ${member.verdict} | ${member.emailVersion} |`
    );
  }
  lines.push("");
  const neverSignedIn = cohort.filter((m) => m.verdict === "never-signed-in");
  if (neverSignedIn.length > 0) {
    lines.push(
      `**${neverSignedIn.length} of ${cohort.length} accounts produced zero events after signup.** These are not disinterested users; they are accounts that were created and then never used. Check whether signup signs the user in on the platform they used.`
    );
    lines.push("");
  }

  const renderFunnel = (
    heading: string,
    steps: Array<{ event: string; label: string }>,
    note: string
  ): { biggestDropLabel: string; biggestDropPct: string } => {
    lines.push(heading);
    lines.push("");
    lines.push("| Step | Count | Of previous step | Of first step |");
    lines.push("| --- | ---: | ---: | ---: |");
    const first = eventCounts.get(steps[0].event) ?? 0;
    let previous = first;
    let biggestDropLabel = "";
    let biggestDropRate = 1;
    for (const step of steps) {
      const count = eventCounts.get(step.event) ?? 0;
      const rate = previous === 0 ? 1 : count / previous;
      if (step !== steps[0] && rate < biggestDropRate) {
        biggestDropRate = rate;
        biggestDropLabel = step.label;
      }
      lines.push(`| ${step.label} | ${count} | ${pct(count, previous)} | ${pct(count, first)} |`);
      previous = count;
    }
    lines.push("");
    lines.push(note);
    lines.push("");
    return {
      biggestDropLabel,
      biggestDropPct: `${(biggestDropRate * 100).toFixed(1)}%`,
    };
  };

  const acquisitionDrop = renderFunnel(
    "## 2. Acquisition funnel (all traffic this window)",
    ACQUISITION_STEPS,
    "Steps are independent event counts over one window, not a joined per-user funnel. A step can exceed 100% when the population is not a strict subset of the step above it. Read it for the collapsing step, not for an exact conversion rate."
  );
  lines.push(
    `**Biggest acquisition drop: ${acquisitionDrop.biggestDropLabel} at ${acquisitionDrop.biggestDropPct} of the step before it.**`
  );
  lines.push("");

  const activationDrop = renderFunnel(
    "## 2b. Activation funnel (all users, not only new signups)",
    ACTIVATION_STEPS,
    "Session logging is driven by the existing base, so this is deliberately not scoped to the signup cohort."
  );
  lines.push(
    `**Biggest activation drop: ${activationDrop.biggestDropLabel} at ${activationDrop.biggestDropPct} of the step before it.**`
  );
  lines.push("");

  lines.push("## 3. Friction gates");
  lines.push("");
  lines.push("| Gate | Failures | Users | Baseline | Mode | Ratio | Threshold | Fired |");
  lines.push("| --- | ---: | ---: | ---: | --- | ---: | ---: | --- |");
  for (const row of firedGates) {
    const ratio = row.ratio === Infinity ? "∞" : row.ratio.toFixed(2);
    lines.push(
      `| ${row.gate.label} | ${row.fails} | ${row.distinctUsers || "—"} | ${row.base} | ${row.gate.mode} | ${ratio} | ${row.gate.threshold} | ${row.fired ? "**yes**" : "no"} |`
    );
  }
  lines.push("");
  lines.push(
    "Thresholds, denominators, and benign-reason exclusions live in `FRICTION_GATES` in `scripts/weekly-signup-intel.ts`. A gate fires only when the failure count also clears its `minCount`, so a two-event week cannot manufacture a priority."
  );
  lines.push("");

  for (const row of firedGates.filter((r) => r.fails > 0 && r.topReasons.length > 0)) {
    lines.push(
      `**${row.gate.label}** — ${row.fails} failures across ${row.distinctUsers || "an unknown number of"} user(s)${row.distinctUsers ? "" : " (these events fire before the user is identified)"}.`
    );
    lines.push("");
    for (const [reason, count] of row.topReasons) lines.push(`- ${count} × \`${reason}\``);
    if (row.topFlowShare >= 0.5 && row.distinctFlows > 0) {
      lines.push(
        `- **Concentration: one flow accounts for ${(row.topFlowShare * 100).toFixed(0)}% of these failures across ${row.distinctFlows} distinct flow(s).** Treat this as one user stuck in a loop, not a population-wide failure.`
      );
    }
    lines.push("");
  }

  if (errorSurfaces.size > 0) {
    lines.push("### Errors by surface");
    lines.push("");
    for (const [key, count] of [...errorSurfaces].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`- ${count} × ${key}`);
    }
    lines.push("");
  }

  if (emptyStates.size > 0) {
    lines.push("### Empty states shown");
    lines.push("");
    for (const [surface, count] of [...emptyStates].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`- ${count} × ${surface}`);
    }
    lines.push("");
  }

  lines.push("## 4. Action list");
  lines.push("");
  const actions: string[] = [];
  for (const member of cohort.filter((m) => !m.isRelay)) {
    actions.push(
      `- [SEND EMAIL] ${member.email} — version ${member.emailVersion} (${member.verdict}, ${member.eventCount} events). Draft is in Gmail; review before sending.`
    );
  }
  for (const member of cohort.filter((m) => m.isRelay)) {
    actions.push(
      `- [NO EMAIL] ${member.email} — Apple private relay, not sendable from a personal Gmail. ${member.verdict}, ${member.eventCount} events.`
    );
  }
  for (const row of firedGates.filter((r) => r.fired)) {
    actions.push(
      `- [APPLY FIX] ${row.gate.label}: ${row.fails} failures against ${row.base} baseline events. Owner: \`${row.gate.owner}\`. ${row.gate.fix}`
    );
  }
  if (neverSignedIn.length > 0) {
    actions.push(
      `- [APPLY FIX] ${neverSignedIn.length} account(s) created with zero follow-on events. Confirm signup leaves the user authenticated instead of returning them to a login screen.`
    );
  }
  lines.push(...actions);
  lines.push("");
  lines.push(
    "Every line above is either an email to review and send, or a change to make. Nothing in this routine sends, commits, or deploys."
  );
  lines.push("");

  const outPath = path.join(OUTPUT_DIR, `${reportDate}.md`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);

  console.log(
    JSON.stringify(
      {
        reportPath: outPath,
        windowDays: days,
        newAccounts: cohort.length,
        totalEvents: events.length,
        distinctEventTypes: eventCounts.size,
        neverSignedIn: neverSignedIn.length,
        gatesFired: firedGates.filter((r) => r.fired).map((r) => r.gate.id),
        emailActions: cohort.filter((m) => !m.isRelay).length,
      },
      null,
      2
    )
  );
}

void main();
