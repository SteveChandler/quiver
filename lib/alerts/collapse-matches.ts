import type { MatchingWindow } from "@/lib/alerts/types";

function instantKey(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? String(ms) : iso;
}

function windowKey(match: MatchingWindow): string {
  return `${match.beach_id}|${instantKey(match.window_start)}|${instantKey(match.window_end)}`;
}

/**
 * Two rules that match the same beach for the same window describe one surf,
 * so a message shows it once. The kept match is `keep` when it is in the
 * group, else the best score. Group order follows first appearance.
 */
export function collapseSameWindowMatches<T extends MatchingWindow>(
  matches: T[],
  keep?: MatchingWindow | null,
): T[] {
  const winners = new Map<string, T>();
  for (const match of matches) {
    const key = windowKey(match);
    const current = winners.get(key);
    if (!current) {
      winners.set(key, match);
      continue;
    }
    if (current === keep) continue;
    if (match === keep || match.best_score > current.best_score) {
      winners.set(key, match);
    }
  }
  return [...winners.values()];
}

/** One entry per beach, in the given order. */
export function firstMatchPerBeach<T extends MatchingWindow>(matches: T[]): T[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.beach_id)) return false;
    seen.add(match.beach_id);
    return true;
  });
}
