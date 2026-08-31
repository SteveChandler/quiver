import type {
  OutreachDigestInput,
  OutreachDraftCandidate,
  OutreachRotationCategory,
} from "./types";

const OUTREACH_STATUS_VALUES = new Set([
  "queued",
  "drafted",
  "sent",
  "follow-up",
  "responded",
  "embed-live",
  "declined",
  "rejected",
  "backlink-confirmed",
]);

// Rejection tables list Target/Website/Reason and carry no Status column, so rows under
// them would otherwise default to "queued" and be offered as candidates. Two NXDOMAIN
// surf schools rejected on 2026-08-04 were still surfacing as week-1 targets.
const REJECTED_HEADING = /reject|do not draft|out of scope/i;

const ROTATION_BY_WEEK: OutreachRotationCategory[] = [
  "surf-schools",
  "surf-bloggers",
  "coastal-businesses",
  "publications",
];

export interface OutreachTrackerRow {
  category: OutreachRotationCategory | "other";
  target: string;
  website?: string;
  contact?: string;
  nearestBeach?: string;
  angle?: string;
  notes?: string;
  status: string;
}

export interface OutreachTrackerParse {
  rows: OutreachTrackerRow[];
  statusCounts: Record<string, number>;
  totalRows: number;
}

export function hasDirectEmail(row: OutreachTrackerRow): boolean {
  return Boolean(row.contact && row.contact.includes("@"));
}

export function resolveOutreachRotation(date: string): {
  week: number;
  category: OutreachRotationCategory;
} {
  const day = Number(date.slice(8, 10));
  const rawWeek = Number.isFinite(day) && day > 0 ? Math.ceil(day / 7) : 1;
  const week = ((rawWeek - 1) % ROTATION_BY_WEEK.length) + 1;
  return { week, category: ROTATION_BY_WEEK[week - 1] as OutreachRotationCategory };
}

export function parseOutreachTracker(markdown: string): OutreachTrackerParse {
  const rows: OutreachTrackerRow[] = [];
  const lines = markdown.split(/\r?\n/);
  let category: OutreachRotationCategory | "other" | "skip" = "other";
  let header: string[] | null = null;
  let rejectedSection = false;

  for (const line of lines) {
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      const level = (heading[1] ?? "").length;
      const text = heading[2] ?? "";
      const matched = categoryFromHeading(text);
      if (level === 2 || matched !== "other") category = matched;
      rejectedSection = REJECTED_HEADING.test(text);
      header = null;
      continue;
    }

    if (!line.trim().startsWith("|")) {
      header = null;
      continue;
    }
    if (category === "skip") continue;

    const cells = splitRow(line);
    if (cells.length === 0 || isSeparatorRow(cells)) continue;

    if (!header) {
      header = cells.map(normalizeHeader);
      continue;
    }

    // A target table always declares a status. Tables without one are narrative context
    // (warm-lead summaries, contact histories, run logs) and must not become candidates —
    // they would otherwise default to "queued" and re-pitch people who already replied.
    // Rejection tables are the one exception: no status column, but they must still parse.
    if (!rejectedSection && !hasStatusColumn(header)) continue;

    const row = buildRow(category, header, cells, rejectedSection);
    if (row) rows.push(row);
  }

  const statusCounts: Record<string, number> = {};
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  return { rows, statusCounts, totalRows: rows.length };
}

export function buildOutreachDigest(
  generatedAt: string,
  options: {
    reportDate: string;
    markdown: string;
    maxCandidates?: number;
  },
): OutreachDigestInput {
  const missing: string[] = [];
  const { reportDate, markdown } = options;
  const maxCandidates = options.maxCandidates ?? 3;

  if (!markdown.trim()) missing.push("docs/seo/outreach-tracker.md");

  const { rows, statusCounts, totalRows } = parseOutreachTracker(markdown);
  const { week, category } = resolveOutreachRotation(reportDate);
  const queued = rows.filter(
    (row) => row.category === category && row.status === "queued",
  );

  if (markdown.trim() && queued.length === 0) {
    missing.push(`No queued outreach targets for rotation category "${category}"`);
  }

  const candidates = queued
    .slice(0, maxCandidates)
    .map((row) => buildDraftCandidate(row, category));

  return {
    generatedAt,
    reportDate,
    rotationWeek: week,
    rotationCategory: category,
    statusCounts,
    totalRows,
    candidates,
    missing,
  };
}

export function buildDraftCandidate(
  row: OutreachTrackerRow,
  category: OutreachRotationCategory,
): OutreachDraftCandidate {
  const { subject, body } = draftCopy(row, category);
  return {
    target: row.target,
    category,
    website: row.website,
    contact: row.contact,
    requiresContactResearch: !hasDirectEmail(row),
    nearestBeach: row.nearestBeach,
    angle: row.angle,
    notes: row.notes,
    subject,
    body,
  };
}

// Beach columns hold URL slugs (`linda-mar-pacifica-ca`), which read badly in a
// sentence. Drop the trailing state code and title-case the rest.
function humanizeBeach(slug: string | undefined): string | undefined {
  if (!slug) return undefined;
  const words = slug.split("-").filter(Boolean);
  if (words.length > 1 && /^[a-z]{2}$/.test(words[words.length - 1] ?? "")) words.pop();
  if (words.length === 0) return undefined;
  return words
    .map((word) => (/[A-Z]/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// Quiver ships no live ML forecast — ML corrections have been off since 2026-04-23
// because raw Open-Meteo beat them by 35% MAE. No template may claim ML, AI, or a
// spot count, and none may claim Quiver beats a named competitor.
function draftCopy(
  row: OutreachTrackerRow,
  category: OutreachRotationCategory,
): { subject: string; body: string } {
  const where = humanizeBeach(row.nearestBeach) ?? "your local breaks";
  const opener = row.target ? `Hi ${row.target} team,` : "Hi,";
  const signoff = "Cheers,\nSteven\nQuiver - free surf forecasts (quiversurf.app)";

  if (category === "surf-schools") {
    return {
      subject: `Free surf forecasts for ${where}`,
      body: [
        opener,
        "",
        `I run Quiver, a free surf-forecast site. We have a conditions page for ${where}, alongside beach pages across 16 states and Puerto Rico. No login, no paywall.`,
        "Happy to set you up with a free embeddable conditions widget for your site, or just be a resource people can check before a session.",
        "You can see it live here: https://www.quiversurf.app/for-surf-schools",
        "Would a quick look be useful? A one-line no is completely fine.",
        "",
        signoff,
      ].join("\n"),
    };
  }

  if (category === "surf-bloggers") {
    return {
      subject: "A free surf-forecast tool your audience might dig",
      body: [
        opener,
        "",
        "Big fan of your surf content. I built Quiver: free surf forecasts across the US, with session logging and no premium paywall.",
        "If it is a fit, I would love to get it in front of your audience: an honest look, an embeddable conditions widget, or a walkthrough, whatever works for you.",
        "A one-line no is completely fine.",
        "",
        signoff,
      ].join("\n"),
    };
  }

  if (category === "coastal-businesses") {
    return {
      subject: `Free live surf conditions for ${where} visitors`,
      body: [
        opener,
        "",
        `Quiver is a free surf-forecast site with live conditions for ${where}. I can give you a free embeddable widget so your visitors can check the surf right on your site.`,
        "No cost, no catch: just a useful add for a coastal audience. Want me to send the embed?",
        "A one-line no is completely fine.",
        "",
        signoff,
      ].join("\n"),
    };
  }

  const angle = row.angle
    ? row.angle
    : "what surfer-logged sessions reveal about wave forecasts";
  return {
    subject: `Story idea: ${angle}`,
    body: [
      opener,
      "",
      `I run Quiver, a free surf-forecast site. Possible angle for you: ${angle}. Wave models are validated against offshore buoys, and buoys are sparse and sit a long way from the sand. We collect what surfers report at the beach, so we can show where the model and the beach disagree.`,
      "Happy to hand over the raw data and the methodology, with no expectation of a link.",
      "",
      signoff,
    ].join("\n"),
  };
}

function categoryFromHeading(heading: string): OutreachRotationCategory | "other" | "skip" {
  const text = heading.toLowerCase();
  if (/how this file works|status legend|weekly rotation|monthly metrics/.test(text)) {
    return "skip";
  }
  if (/surf school/.test(text)) return "surf-schools";
  if (/blogger|influencer/.test(text)) return "surf-bloggers";
  if (/coastal business|hotel|tourism|shop/.test(text)) return "coastal-businesses";
  if (/publication|guest post|data story|pitch/.test(text)) return "publications";
  return "other";
}

function buildRow(
  category: OutreachRotationCategory | "other",
  header: string[],
  cells: string[],
  rejectedSection: boolean,
): OutreachTrackerRow | null {
  const target = stripCode(cells[0] ?? "");
  if (!target) return null;
  if (OUTREACH_STATUS_VALUES.has(stripCode(target).toLowerCase())) return null;

  const get = (names: string[]): string | undefined => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index >= 0) {
        const value = stripCode(cells[index] ?? "");
        if (value) return value;
      }
    }
    return undefined;
  };

  // Header cells in the live tracker are "Beach slug (verified 200)" and
  // "Nearest Beach (verified 200)". Neither normalizes to "nearestbeach", so the
  // exact-match lookup always returned undefined and every draft fell back to the
  // "your local breaks" placeholder. Match on prefix instead.
  const getPrefix = (prefixes: string[]): string | undefined => {
    for (const prefix of prefixes) {
      const index = header.findIndex((name) => name.startsWith(prefix));
      if (index >= 0) {
        const value = stripCode(cells[index] ?? "");
        if (value) return value;
      }
    }
    return undefined;
  };

  const statusRaw = get(["status", "accountstatus"]);
  const status = rejectedSection
    ? "rejected"
    : statusRaw && OUTREACH_STATUS_VALUES.has(statusRaw.toLowerCase())
      ? statusRaw.toLowerCase()
      : "queued";

  return {
    category,
    target,
    website: get(["website", "websitechannel", "url", "directory"]),
    contact: get(["contact"]),
    nearestBeach: getPrefix(["nearestbeach", "beachslug"]),
    angle: get(["angle"]),
    notes: get(["notes", "reason"]),
    status,
  };
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function hasStatusColumn(header: string[]): boolean {
  return header.includes("status") || header.includes("accountstatus");
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell) || cell === "");
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function stripCode(value: string): string {
  return value.replace(/`/g, "").trim();
}
