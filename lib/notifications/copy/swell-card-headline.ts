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
// The card judges a first-alert title by its text, not the push's context tags: a
// beach-free title states no rarity, so these two tags are safe there. Direction,
// period and region tags stay out because those titles may name what the card lacks.
const CARD_COMING_TAGS = new Set([...COMING_NEUTRAL_TAGS, "biggest-in-weeks", "first-after-flat"]);
const BEACH_PLACEHOLDER = /\{beach\d*\}/;
const WEEKEND_DAYS = new Set(["Saturday", "Sunday"]);
const WEEKDAY_DAYS = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
/** First-alert entries written with the follow-ups work; the card prefers them. */
const CARD_PREFERRED_COMING_IDS = new Set(["s41", "s42", "s43", "s44", "s45", "s46", "s47", "s48"]);

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

/** First-alert titles safe on a card that already shows the beach and has no push context. */
function isCardComingPickable(entry: HeadlineEntry, peakDayLabel?: string): boolean {
  if (BEACH_PLACEHOLDER.test(entry.title)) return false;
  return entry.tags.every((tag) => {
    if (CARD_COMING_TAGS.has(tag)) return true;
    if (tag === "weekend") return peakDayLabel !== undefined && WEEKEND_DAYS.has(peakDayLabel);
    if (tag === "weekday") return peakDayLabel !== undefined && WEEKDAY_DAYS.has(peakDayLabel);
    return false;
  });
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
  cardSuitable?: boolean;
}): { titleId: string; headline: string } {
  const entries = entriesFor(args.kind);
  // Card-only: a first alert on a card already shows the beach in its own tag.
  const cardComing = args.cardSuitable === true && args.kind === "coming" && args.serious !== true;
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
    .filter((entry) =>
      isSeriousEntry(entry) === serious &&
      (cardComing
        ? isCardComingPickable(entry, args.peakDayLabel)
        : isPickable(args.kind, entry, args.moveDirection)),
    )
    .flatMap((entry) => {
      const headline = render(entry.title, vars);
      return headline ? [{ titleId: entry.id, headline }] : [];
    });
  const preferred = cardComing
    ? rendered.filter(({ titleId }) => CARD_PREFERRED_COMING_IDS.has(titleId))
    : [];
  const pool = preferred.length > 0 ? preferred : rendered;
  const fitting = pool.filter(({ headline }) => [...headline].length <= PUSH_TITLE_MAX_CHARS);
  const candidates = fitting.length > 0 ? fitting : pool;
  if (candidates.length > 0) return candidates[hashIndex(args.eventKey, candidates.length)];

  if (cardComing) {
    const headline = render("Swell peaks {day}", vars);
    return headline
      ? { titleId: COMING_FALLBACK_TITLE_ID, headline }
      : { titleId: "plain", headline: "Swell on the way" };
  }
  return {
    titleId: "plain",
    headline: render(PLAIN_HEADLINES[args.kind], vars) ?? "Swell update",
  };
}

/**
 * `cardSuitable` is for the share card only (page, JSON and images): a first
 * alert without a valid title id then skips titles that repeat the beach name.
 * Pushes never pass it, so their selection is untouched.
 */
export function getSwellCardHeadline(args: { titleId?: string; kind: SwellKind; eventKey: string; beachName: string; peakDayLabel?: string; serious?: boolean; cardSuitable?: boolean }): { titleId: string; headline: string } {
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
