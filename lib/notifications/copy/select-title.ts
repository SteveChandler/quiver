import { createHash } from "node:crypto";

import titlePool from "./surf-titles.v1.json";

export type Pool = "daily" | "swell";

export interface TitleVars {
  [key: string]: string;
}

export interface SelectTitleArgs {
  pool: Pool;
  tags: string[];
  userId: string;
  eventKey: string;
  recentTitleIds: string[];
  recentFilmCount: number;
  vars: TitleVars;
}

export interface SelectedTitle {
  id: string;
  title: string;
  body: string;
  fallback: boolean;
}

interface TitleEntry {
  id: string;
  title: string;
  body: string;
  tags: string[];
  film: boolean;
}

export const TITLE_MAX_CHARS = 40;

export const SWELL_TAG_PRIORITY = [
  "serious",
  "hawaii",
  "biggest-in-weeks",
  "first-after-flat",
  "weekend",
  "weekday",
  "long-period",
  "south",
  "northwest",
  "manageable",
  "generic",
] as const;

const DAILY_TAG_PRIORITY = [
  "tide-driven",
  "wind-driven",
  "early",
  "afternoon",
  "home-beach",
  "not-home",
  "live",
  "generic",
] as const;

export function renderTemplate(template: string, vars: TitleVars): string {
  return template.replace(/\{([^{}]+)\}/g, (_match, key: string) => {
    if (!(key in vars)) {
      throw new Error(`Missing template variable: ${key}`);
    }

    return vars[key];
  });
}

function titleLength(title: string): number {
  return [...title].length;
}

function hashIndex(value: string, length: number): number {
  return createHash("sha256").update(value).digest().readUInt32BE(0) % length;
}

function fallbackTitle(pool: Pool, vars: TitleVars): string {
  return renderTemplate(
    pool === "daily" ? "{beach} {start}–{end}" : "Swell peaks {peak_day}",
    vars,
  );
}

export function selectTitle(args: SelectTitleArgs): SelectedTitle {
  const entries: readonly TitleEntry[] = titlePool[args.pool];
  const recentIds = new Set(args.recentTitleIds);
  let candidates = entries.filter((entry) =>
    entry.tags.every((tag) => args.tags.includes(tag)) && !recentIds.has(entry.id),
  );

  if (args.tags.includes("serious")) {
    candidates = candidates.filter((entry) => entry.tags.includes("serious"));
  }

  if (args.pool === "swell" && args.recentFilmCount >= 1) {
    candidates = candidates.filter((entry) => !entry.film);
  }

  const priority = args.pool === "swell" ? SWELL_TAG_PRIORITY : DAILY_TAG_PRIORITY;
  const bestRank = Math.min(...candidates.map((entry) => {
    const rank = priority.findIndex((tag) => entry.tags.includes(tag));
    return rank === -1 ? priority.length : rank;
  }));
  const topRanked = candidates.filter((entry) => {
    const rank = priority.findIndex((tag) => entry.tags.includes(tag));
    return (rank === -1 ? priority.length : rank) === bestRank;
  });
  const selected = topRanked.length > 0
    ? topRanked[hashIndex(`${args.userId}${args.eventKey}`, topRanked.length)]
    : undefined;

  if (!selected) {
    return {
      id: "fallback",
      title: fallbackTitle(args.pool, args.vars),
      body: "",
      fallback: true,
    };
  }

  const renderedTitle = renderTemplate(selected.title, args.vars);
  if (titleLength(renderedTitle) <= TITLE_MAX_CHARS) {
    return {
      id: selected.id,
      title: renderedTitle,
      body: renderTemplate(selected.body, args.vars),
      fallback: false,
    };
  }

  const shortest = candidates
    .map((entry) => ({
      entry,
      title: renderTemplate(entry.title, args.vars),
    }))
    .filter(({ title }) => titleLength(title) <= TITLE_MAX_CHARS)
    .sort((left, right) => titleLength(left.title) - titleLength(right.title))[0];

  if (shortest) {
    return {
      id: shortest.entry.id,
      title: shortest.title,
      body: renderTemplate(shortest.entry.body, args.vars),
      fallback: false,
    };
  }

  return {
    id: "fallback",
    title: fallbackTitle(args.pool, args.vars),
    body: renderTemplate(selected.body, args.vars),
    fallback: true,
  };
}
