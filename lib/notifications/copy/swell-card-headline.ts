import followupPool from "./swell-followup-titles.v1.json";
import titlePool from "./surf-titles.v1.json";

export type SwellKind = 'coming' | 'bigger' | 'smaller' | 'moved' | 'dropped' | 'arrived'

export const SWELL_KINDS: readonly SwellKind[] = [
  "coming",
  "bigger",
  "smaller",
  "moved",
  "dropped",
  "arrived",
];

export type SwellFollowupKind = Exclude<SwellKind, "coming">;

/** Which way a peak moved; picks "running late" or "early" copy for `moved`. */
export type SwellMoveDirection = "later" | "earlier";

const SWELL_SHARE_BASE_URL = "https://www.quiversurf.app/app/swell";

/** selectTitle's id when no pool title fits; rendered here so the card matches the push. */
const COMING_FALLBACK_TITLE_ID = "fallback";
// Same limit as TITLE_MAX_CHARS in select-title.ts, which imports node:crypto
// and so cannot be pulled into the edge and client code that renders cards.
const PUSH_TITLE_MAX_CHARS = 40;
// Tags that state no fact about the swell; only these are safe without the push's own context.
const COMING_NEUTRAL_TAGS = new Set(["generic", "manageable", "serious"]);
const MOVE_DIRECTION_TAGS: readonly string[] = ["later", "earlier"];

interface HeadlineEntry {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

const PLAIN_HEADLINES: Record<SwellKind, string> = {
  coming: "Swell on the way to {beach}",
  bigger: "{beach}: forecast size increased",
  smaller: "{beach}: forecast size decreased",
  moved: "{beach}: peak timing revised",
  dropped: "{beach}: swell no longer forecast",
  arrived: "Swell peaks today at {beach}",
};

export function isSwellKind(value: unknown): value is SwellKind {
  return typeof value === "string" && (SWELL_KINDS as readonly string[]).includes(value);
}

function entriesFor(kind: SwellKind): readonly HeadlineEntry[] {
  return kind === "coming" ? titlePool.swell : followupPool[kind];
}

function render(template: string, vars: Record<string, string | undefined>): string | null {
  let missing = false;
  const text = template.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value.length === 0) {
      missing = true;
      return "";
    }
    return value;
  });
  return missing ? null : text;
}

/** FNV-1a: deterministic on every runtime (node, edge, browser) without node:crypto. */
function hashIndex(value: string, length: number): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % length;
}

function isSeriousEntry(entry: HeadlineEntry): boolean {
  return entry.tags.includes("serious");
}

function isPickable(kind: SwellKind, entry: HeadlineEntry, moveDirection?: SwellMoveDirection): boolean {
  if (kind === "coming") return entry.tags.every((tag) => COMING_NEUTRAL_TAGS.has(tag));
  return entry.tags.every((tag) => !MOVE_DIRECTION_TAGS.includes(tag) || tag === moveDirection);
}

function headlineVars(args: { beachName: string; peakDayLabel?: string }): Record<string, string | undefined> {
  return {
    beach: args.beachName,
    beach1: args.beachName,
    day: args.peakDayLabel,
    peak_day: args.peakDayLabel,
  };
}

function pickHeadline(args: {
  titleId?: string;
  kind: SwellKind;
  eventKey: string;
  beachName: string;
  peakDayLabel?: string;
  serious?: boolean;
  moveDirection?: SwellMoveDirection;
}): { titleId: string; headline: string } {
  const entries = entriesFor(args.kind);
  const vars = headlineVars(args);
  const serious = args.serious === true;

  if (args.titleId) {
    if (args.kind === "coming" && args.titleId === COMING_FALLBACK_TITLE_ID) {
      const headline = render("Swell peaks {day}", vars);
      if (headline) return { titleId: COMING_FALLBACK_TITLE_ID, headline };
    }
    const named = entries.find((entry) => entry.id === args.titleId);
    // A joke title id is never honoured on a serious swell.
    if (named && (!serious || isSeriousEntry(named))) {
      const headline = render(named.title, vars);
      if (headline) return { titleId: named.id, headline };
    }
  }

  const rendered = entries
    .filter((entry) => isSeriousEntry(entry) === serious && isPickable(args.kind, entry, args.moveDirection))
    .flatMap((entry) => {
      const headline = render(entry.title, vars);
      return headline ? [{ titleId: entry.id, headline }] : [];
    });
  const fitting = rendered.filter(({ headline }) => [...headline].length <= PUSH_TITLE_MAX_CHARS);
  const candidates = fitting.length > 0 ? fitting : rendered;
  if (candidates.length > 0) return candidates[hashIndex(args.eventKey, candidates.length)];

  return {
    titleId: "plain",
    headline: render(PLAIN_HEADLINES[args.kind], vars) ?? "Swell update",
  };
}

export function getSwellCardHeadline(args: { titleId?: string; kind: SwellKind; eventKey: string; beachName: string; peakDayLabel?: string; serious?: boolean }): { titleId: string; headline: string } {
  return pickHeadline(args);
}

/**
 * The push producer's pick. Same pools and hash as the card, plus the one fact
 * only the producer knows: which way a moved peak went.
 */
export function pickSwellFollowupHeadline(args: {
  kind: SwellFollowupKind;
  eventKey: string;
  beachName: string;
  peakDayLabel?: string;
  serious?: boolean;
  moveDirection?: SwellMoveDirection;
}): { titleId: string; headline: string } {
  return pickHeadline(args);
}

/** Push body for a follow-up title; null when the id is not in the kind's pool or a variable is missing. */
export function renderSwellFollowupBody(args: {
  kind: SwellFollowupKind;
  titleId: string;
  vars: Record<string, string>;
}): string | null {
  const entry = followupPool[args.kind].find(({ id }) => id === args.titleId);
  return entry ? render(entry.body, args.vars) : null;
}

export function buildSwellShareUrl(eventKey: string, kind: SwellKind, titleId: string): string {
  return `${SWELL_SHARE_BASE_URL}/${encodeURIComponent(eventKey)}?k=${kind}&t=${encodeURIComponent(titleId)}`;
}
