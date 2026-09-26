import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getSurfClimatology } from "@/lib/climatology/get-surf-climatology";
import { getSeasonPhotos } from "@/lib/climatology/season-photos";
import { buildDataBackedSeasonView } from "@/lib/climatology/season-view";
import { getSeasonCopy } from "@/lib/data/surf-climatology/copy";

const BANNED: Array<[string, RegExp]> = [
  ["a not-just reversal", /\bnot (just|merely|only)\b[^.]*[,;—]\s*(it'?s|but)\b/i],
  ["an it's-not-X-it's-Y line", /\bit'?s not\b[^.]*,\s*it'?s\b/i],
  ["whether you're", /\bwhether you'?re\b/i],
  ["stunning", /\bstunning\b/i],
  ["nestled", /\bnestled\b/i],
  ["hidden gem", /\bhidden gem\b/i],
  ["breathtaking", /\bbreathtaking\b/i],
  ["in this guide", /\bin this guide\b/i],
  ["comprehensive", /\bcomprehensive\b/i],
  ["unlock", /\bunlock/i],
  ["elevate", /\belevate/i],
  ["dive into", /\bdive into\b/i],
  ["magic", /\bmagic/i],
  ["bold emphasis", /\*\*|<strong|<b>/i],
];

// Skip the "bold emphasis" pattern for component SOURCE files: a JSDoc `/**` block
// is not emphasis. The pattern still applies to rendered copy text above.
const COMPONENT_SOURCE_PATTERNS = BANNED.filter(([label]) => label !== "bold emphasis");

const COMPONENT_FILES = [
  "buoy-month-table.tsx",
  "direction-mix-chart.tsx",
  "score-by-month-chart.tsx",
  "score-explainer.tsx",
  "season-photo.tsx",
  "source-line.tsx",
  "station-map.tsx",
  "swell-days-chart.tsx",
  "wave-range-chart.tsx",
  "wind-by-time-chart.tsx",
].map((file) => join(process.cwd(), "components/best-time-to-surf/buoy-record", file));

function renderedText(slug: string): string[] {
  const dataset = getSurfClimatology(slug);
  if (!dataset) throw new Error(`no dataset for ${slug}`);
  const copy = getSeasonCopy(slug);
  const texts: string[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const view = buildDataBackedSeasonView(dataset, month);
    texts.push(view.weekAnswer, view.heroDetail, view.bestMonthFaq, view.waterFaq, view.yearRoundFaq);
    if (!copy) continue;
    const context = { dataset, view };
    texts.push(
      copy.answerHeading(context),
      ...copy.answer(context),
      copy.comparisonHeading,
      ...copy.comparison(context),
      copy.limitsHeading,
      ...copy.limits(context),
    );
    if (copy.seasonNote) texts.push(copy.seasonNote.heading, ...copy.seasonNote.paragraphs(context));
    if (copy.bestMonthFaq) texts.push(copy.bestMonthFaq(context));
  }
  for (const photo of getSeasonPhotos(slug)) texts.push(photo.alt, photo.caption);
  return texts;
}

describe.each(["cocoa-beach", "newport-beach", "honolulu"])("%s page text", (slug) => {
  it.each(BANNED)("contains no %s", (_label, pattern) => {
    for (const text of renderedText(slug)) expect(text).not.toMatch(pattern);
  });

  it("never calls a buoy number waves or surf", () => {
    for (const text of renderedText(slug)) {
      expect(text).not.toMatch(/\d(\.\d)?\s*ft (waves|surf)\b/i);
    }
  });

  it("prints no undefined, NaN or null", () => {
    for (const text of renderedText(slug)) expect(text).not.toMatch(/undefined|NaN|\bnull\b/);
  });
});

describe("season copy", () => {
  it("exists for Newport and Cocoa only", () => {
    expect(getSeasonCopy("cocoa-beach")).not.toBeNull();
    expect(getSeasonCopy("newport-beach")).not.toBeNull();
    expect(getSeasonCopy("honolulu")).toBeNull();
  });

  it("gives each city its own headings", () => {
    const headings = (slug: string): string[] => {
      const dataset = getSurfClimatology(slug);
      const copy = getSeasonCopy(slug);
      if (!dataset || !copy) throw new Error(`missing ${slug}`);
      const context = { dataset, view: buildDataBackedSeasonView(dataset, 1) };
      const result = [copy.answerHeading(context), copy.comparisonHeading, copy.limitsHeading];
      if (copy.seasonNote) result.push(copy.seasonNote.heading);
      return result;
    };
    const cocoa = headings("cocoa-beach");
    for (const heading of headings("newport-beach")) expect(cocoa).not.toContain(heading);
  });

  it("gives Newport a season note built from the dataset", () => {
    const dataset = getSurfClimatology("newport-beach");
    const copy = getSeasonCopy("newport-beach");
    if (!dataset || !copy?.seasonNote) throw new Error("missing Newport season note");
    const paragraphs = copy.seasonNote.paragraphs({ dataset, view: buildDataBackedSeasonView(dataset, 7) });
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toMatch(/From December to February, \d+% of days/);
  });

  // Quiver's pages rest on Quiver's own analysis, not a competitor's guide.
  it.each(["cocoa-beach", "newport-beach"])("%s cites no competitor", (slug) => {
    const copy = getSeasonCopy(slug);
    if (!copy) throw new Error(`missing ${slug}`);
    for (const source of copy.sources) expect(source.url).not.toMatch(/surfline\.com/i);
    for (const text of renderedText(slug)) expect(text).not.toMatch(/surfline/i);
  });

  it.each(COMPONENT_FILES)("%s contains no banned phrase", (file) => {
    const source = readFileSync(file, "utf8");
    for (const [, pattern] of COMPONENT_SOURCE_PATTERNS) expect(source).not.toMatch(pattern);
  });
});
