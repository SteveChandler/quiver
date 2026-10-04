/**
 * @jest-environment node
 */

import { createHash } from "node:crypto";

import followupPool from "@/lib/notifications/copy/swell-followup-titles.v1.json";
import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import { TITLE_MAX_CHARS } from "@/lib/notifications/copy/select-title";
import {
  SWELL_KINDS,
  buildSwellShareUrl,
  getSwellCardHeadline,
  isSwellKind,
  pickSwellFollowupHeadline,
  renderSwellFollowupBody,
  type SwellFollowupKind,
} from "@/lib/notifications/copy/swell-card-headline";

const EVENT_KEY = "11111111-1111-4111-8111-111111111111:NW:2026-09-26";
const FOLLOWUP_KINDS: SwellFollowupKind[] = ["bigger", "smaller", "moved", "dropped", "arrived"];
const BODY_VARS = {
  beach: "Blacks",
  size: "6ft",
  period: "15s",
  day: "Saturday",
  part: "morning",
  prev_size: "4.5ft",
  prev_day: "Friday",
};

function allCopy(): string[] {
  return [
    ...titlePool.swell,
    ...FOLLOWUP_KINDS.flatMap((kind) => followupPool[kind]),
  ].flatMap((entry) => [entry.title, entry.body]);
}

describe("swell follow-up title pools", () => {
  it.each(FOLLOWUP_KINDS)("has at least 6 humorous and 2 plain entries for %s", (kind) => {
    const entries = followupPool[kind];
    expect(entries.filter((entry) => !entry.tags.includes("serious")).length).toBeGreaterThanOrEqual(6);
    expect(entries.filter((entry) => entry.tags.includes("serious")).length).toBeGreaterThanOrEqual(2);
  });

  it("keeps ids unique across every pool", () => {
    const ids = [...titlePool.swell, ...FOLLOWUP_KINDS.flatMap((kind) => followupPool[kind])].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never says 'the call', claims AI or machine learning, or uses an em dash", () => {
    const banned = /the call|\bAI\b|machine[- ]learning|\bML\b|algorithm|neural|—|–/i;
    expect(allCopy().filter((copy) => banned.test(copy))).toEqual([]);
  });

  it.each(FOLLOWUP_KINDS)("renders every %s body from the runner's variables", (kind) => {
    for (const entry of followupPool[kind]) {
      const body = renderSwellFollowupBody({ kind, titleId: entry.id, vars: BODY_VARS });
      expect(body).toEqual(expect.any(String));
      expect(body).not.toMatch(/[{}]/);
    }
  });

  it("keeps jokes out of serious entries", () => {
    const jokes = /dentist|boss|gym|ghost|brunch|excuse|memo|rude|plot twist|on read/i;
    const serious = FOLLOWUP_KINDS.flatMap((kind) => followupPool[kind])
      .filter((entry) => entry.tags.includes("serious"));
    expect(serious.filter((entry) => jokes.test(`${entry.title} ${entry.body}`))).toEqual([]);
  });
});

describe("getSwellCardHeadline", () => {
  it("uses a valid title id for the kind", () => {
    expect(getSwellCardHeadline({
      titleId: "mv01",
      kind: "moved",
      eventKey: EVENT_KEY,
      beachName: "Blacks",
      peakDayLabel: "Sunday",
    })).toEqual({ titleId: "mv01", headline: "Swell's running late. Now Sunday." });
  });

  it("renders a first-alert title id exactly as the push title pool does", () => {
    expect(getSwellCardHeadline({
      titleId: "s41",
      kind: "coming",
      eventKey: EVENT_KEY,
      beachName: "Blacks",
      peakDayLabel: "Friday",
    })).toEqual({ titleId: "s41", headline: "Cancel your plans. Blacks, Friday." });
  });

  it("renders the first alert's fallback title", () => {
    expect(getSwellCardHeadline({
      titleId: "fallback",
      kind: "coming",
      eventKey: EVENT_KEY,
      beachName: "Blacks",
      peakDayLabel: "Friday",
    })).toEqual({ titleId: "fallback", headline: "Swell peaks Friday" });
  });

  it("picks deterministically by event key when the id is missing, unknown, or for another kind", () => {
    const base = { kind: "bigger" as const, eventKey: EVENT_KEY, beachName: "Blacks", peakDayLabel: "Saturday" };
    const picked = getSwellCardHeadline(base);

    expect(followupPool.bigger.map(({ id }) => id)).toContain(picked.titleId);
    expect(getSwellCardHeadline(base)).toEqual(picked);
    expect(getSwellCardHeadline({ ...base, titleId: "not-a-title" })).toEqual(picked);
    expect(getSwellCardHeadline({ ...base, titleId: "dr01" })).toEqual(picked);
  });

  it("spreads different events across the pool", () => {
    const ids = new Set(Array.from({ length: 40 }, (_unused, index) => getSwellCardHeadline({
      kind: "dropped",
      eventKey: `beach-${index}:NW:2026-09-26`,
      beachName: "Blacks",
    }).titleId));
    expect(ids.size).toBeGreaterThan(3);
  });

  it("never renders caller-supplied free text as the title", () => {
    const { headline, titleId } = getSwellCardHeadline({
      titleId: "Free pizza at <script>",
      kind: "arrived",
      eventKey: EVENT_KEY,
      beachName: "Blacks",
    });
    expect(headline).not.toContain("pizza");
    expect(followupPool.arrived.map(({ id }) => id)).toContain(titleId);
  });

  it.each(SWELL_KINDS)("uses only plain copy for a serious %s swell", (kind) => {
    const pool = kind === "coming" ? titlePool.swell : followupPool[kind];
    const seriousIds = pool.filter((entry) => entry.tags.includes("serious")).map(({ id }) => id);
    const joke = pool.find((entry) => !entry.tags.includes("serious"));

    for (let index = 0; index < 20; index += 1) {
      const picked = getSwellCardHeadline({
        // A joke id on a serious swell is ignored, not honoured.
        titleId: joke?.id,
        kind,
        eventKey: `beach-${index}:W:2026-09-26`,
        beachName: "Blacks",
        peakDayLabel: "Saturday",
        serious: true,
      });
      expect(seriousIds).toContain(picked.titleId);
    }
  });

  it.each(SWELL_KINDS)("never picks serious copy for an ordinary %s swell", (kind) => {
    const pool = kind === "coming" ? titlePool.swell : followupPool[kind];
    for (let index = 0; index < 20; index += 1) {
      const picked = getSwellCardHeadline({
        kind,
        eventKey: `beach-${index}:W:2026-09-26`,
        beachName: "Blacks",
        peakDayLabel: "Saturday",
      });
      expect(pool.find(({ id }) => id === picked.titleId)?.tags).not.toContain("serious");
    }
  });

  it.each(SWELL_KINDS)("still renders %s without a peak day label", (kind) => {
    for (const serious of [false, true]) {
      const { headline } = getSwellCardHeadline({ kind, eventKey: EVENT_KEY, beachName: "Blacks", serious });
      expect(headline.length).toBeGreaterThan(0);
      expect(headline).not.toMatch(/[{}]/);
    }
  });

  it("keeps an un-named first alert headline free of rarity and weekday claims", () => {
    for (let index = 0; index < 30; index += 1) {
      const { titleId } = getSwellCardHeadline({
        kind: "coming",
        eventKey: `beach-${index}:W:2026-09-26`,
        beachName: "Blacks",
        peakDayLabel: "Saturday",
      });
      const tags = titlePool.swell.find(({ id }) => id === titleId)?.tags ?? ["missing"];
      expect(tags.every((tag) => ["generic", "manageable"].includes(tag))).toBe(true);
    }
  });

  it("prefers a headline that fits a push title when one exists", () => {
    for (const kind of FOLLOWUP_KINDS) {
      const { headline } = getSwellCardHeadline({
        kind,
        eventKey: EVENT_KEY,
        beachName: "Ocean Beach",
        peakDayLabel: "Wednesday",
      });
      expect([...headline].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    }
  });

  it("only uses late or early copy when the producer says which way the peak moved", () => {
    const directional = new Set(followupPool.moved
      .filter((entry) => entry.tags.includes("later") || entry.tags.includes("earlier"))
      .map(({ id }) => id));
    const earlierIds = new Set<string>();

    for (let index = 0; index < 60; index += 1) {
      const base = {
        kind: "moved" as const,
        eventKey: `beach-${index}:W:2026-09-26`,
        beachName: "Blacks",
        peakDayLabel: "Sunday",
      };
      expect(directional.has(getSwellCardHeadline(base).titleId)).toBe(false);
      const earlier = pickSwellFollowupHeadline({ ...base, moveDirection: "earlier" });
      expect(followupPool.moved.find(({ id }) => id === earlier.titleId)?.tags).not.toContain("later");
      earlierIds.add(earlier.titleId);
      // The card renders the producer's pick from its id alone.
      expect(getSwellCardHeadline({ ...base, titleId: earlier.titleId })).toEqual(earlier);
    }
    expect([...earlierIds].some((id) => directional.has(id))).toBe(true);
  });
});

describe("swell share url", () => {
  it("encodes the colons in the event key", () => {
    expect(buildSwellShareUrl(EVENT_KEY, "moved", "mv01")).toBe(
      "https://www.quiversurf.app/app/swell/11111111-1111-4111-8111-111111111111%3ANW%3A2026-09-26?k=moved&t=mv01",
    );
  });

  it("recognises only contract kinds", () => {
    expect(SWELL_KINDS).toEqual(["coming", "bigger", "smaller", "moved", "dropped", "arrived"]);
    expect(isSwellKind("moved")).toBe(true);
    expect(isSwellKind("gone")).toBe(false);
    expect(isSwellKind(undefined)).toBe(false);
  });
});

describe("card-suitable first-alert headlines", () => {
  const BEACH = "Pine Trees (Kohanaiki)";
  const poolEntry = (id: string) => titlePool.swell.find((entry) => entry.id === id)!;
  const pick = (index: number, peakDayLabel: string | null = "Friday", extra: object = {}) =>
    getSwellCardHeadline({
      kind: "coming",
      eventKey: `beach-${index}:NW:2026-10-08`,
      beachName: BEACH,
      peakDayLabel: peakDayLabel ?? undefined,
      cardSuitable: true,
      ...extra,
    });

  it("never repeats the beach name, is deterministic, and prefers the newer entries", () => {
    const ids = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      const picked = pick(index);
      expect(picked.headline).not.toContain("Pine Trees");
      expect(poolEntry(picked.titleId).title).not.toMatch(/\{beach\d*\}/);
      expect(Number(picked.titleId.slice(1))).toBeGreaterThanOrEqual(41);
      expect(pick(index)).toEqual(picked);
      ids.add(picked.titleId);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it("keeps surviving titles free of rarity and size claims", () => {
    for (let index = 0; index < 60; index += 1) {
      expect(pick(index).headline).not.toMatch(/best|weeks|biggest|first|flat|ft\b|big/i);
    }
  });

  it("only uses weekend or weekday titles on a matching peak day", () => {
    for (let index = 0; index < 60; index += 1) {
      const weekday = poolEntry(pick(index, "Tuesday").titleId).tags;
      const weekend = poolEntry(pick(index, "Saturday").titleId).tags;
      expect(weekday).not.toContain("weekend");
      expect(weekend).not.toContain("weekday");
    }
  });

  it("falls back to a beach-free plain line when no title fits", () => {
    for (let index = 0; index < 10; index += 1) {
      // Without a peak day every {peak_day} title is dropped, and the rest name the beach.
      const picked = pick(index, null);
      expect(picked).toEqual({ titleId: "plain", headline: "Swell on the way" });
    }
  });

  it("still honours a valid title id, even one that names the beach", () => {
    expect(pick(1, "Friday", { titleId: "s33" })).toEqual({
      titleId: "s33",
      headline: `Mavericks mood, sane size: ${BEACH}`,
    });
  });

  it("treats an unknown title id like no title id", () => {
    expect(pick(3, "Friday", { titleId: "nope" })).toEqual(pick(3));
  });

  it("keeps serious first alerts on serious-tagged copy", () => {
    const seriousIds = titlePool.swell.filter((entry) => entry.tags.includes("serious")).map(({ id }) => id);
    for (let index = 0; index < 20; index += 1) {
      expect(seriousIds).toContain(pick(index, "Friday", { serious: true }).titleId);
    }
  });

  it("does not change any other kind", () => {
    for (const kind of FOLLOWUP_KINDS) {
      const base = { kind, eventKey: EVENT_KEY, beachName: "Blacks", peakDayLabel: "Friday" };
      expect(getSwellCardHeadline({ ...base, cardSuitable: true })).toEqual(getSwellCardHeadline(base));
    }
  });
});

describe("push title selection is unchanged", () => {
  // Hash of every default pick (cards without the option and the push producer's
  // follow-up picks) over kinds x event keys x severity x peak day x move direction,
  // recorded from the code before cardSuitable existed. A deliberate pool edit updates it.
  it("matches the recorded picks", () => {
    const rows: unknown[] = [];
    for (let index = 0; index < 40; index += 1) {
      const eventKey = `beach-${index}:NW:2026-10-${String((index % 28) + 1).padStart(2, "0")}`;
      for (const serious of [false, true]) {
        for (const peakDayLabel of [undefined, "Monday", "Saturday"]) {
          for (const kind of SWELL_KINDS) {
            const base = { kind, eventKey, beachName: "Blacks", peakDayLabel, serious };
            rows.push(getSwellCardHeadline(base));
            if (kind === "coming") continue;
            for (const moveDirection of [undefined, "later", "earlier"] as const) {
              rows.push(pickSwellFollowupHeadline({ ...base, kind, moveDirection }));
            }
          }
        }
      }
    }
    expect(rows).toHaveLength(5040);
    expect(createHash("sha256").update(JSON.stringify(rows)).digest("hex")).toBe(
      "66ec8770cdc52f0bb4d5ddd17499952aaa988467c9e5f961bc919435b15423a4",
    );
  });
});
