import type { Beach } from "@/types/database";
import { normalizeSearchText } from "@/lib/utils/text-normalization";

interface MatchResult {
  matches: boolean;
  score: number;
  matchType?: string;
}

export function matchBeach(beach: Beach, query: string, alias: string | null): MatchResult {
  const noMatch = { matches: false, score: 0 };
  const name = normalizeSearchText(beach.name);
  const city = normalizeSearchText(beach.city || "");
  const state = normalizeSearchText(beach.state || "");

  if (query) {
    if (name === query) return { matches: true, score: 1000, matchType: "exact-name" };
    if (city === query || normalizeSearchText((beach as any).location || "") === query) {
      return { matches: true, score: 800, matchType: "exact-city" };
    }
  }

  if (alias) {
    if (name === alias) return { matches: true, score: 900, matchType: "alias-exact" };
    if (name.startsWith(`${alias} `)) return { matches: true, score: 850, matchType: "alias-prefix" };
    if (alias.startsWith(name)) return { matches: true, score: 800, matchType: "alias-contains" };
  }

  if (query) {
    if (name.includes(query)) return { matches: true, score: 700, matchType: "substring-name" };
    if (city.includes(query) || state.includes(query)) {
      return { matches: true, score: 600, matchType: "substring-city" };
    }
    if (query.includes(name)) return { matches: true, score: 500, matchType: "substring-reverse" };
  }

  const words = query.split(" ").filter((word) => word.length > 0);
  if (words.length <= 1) return noMatch;
  const allWordsMatch = (target: string): boolean => {
    const targetWords = target.split(" ").filter((word) => word.length > 0);
    return words.every((word) => targetWords.some((candidate) => candidate.includes(word) || word.includes(candidate)));
  };
  if (allWordsMatch(name)) return { matches: true, score: 400, matchType: "word-match-name" };
  if (allWordsMatch(city) || allWordsMatch(state)) {
    return { matches: true, score: 300, matchType: "word-match-city" };
  }
  return noMatch;
}
