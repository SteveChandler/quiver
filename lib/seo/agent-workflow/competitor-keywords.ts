import type { DataForSeoCompetitorKeyword } from "./types";

export function filterRelevantCompetitorKeywordRows(
  rows: DataForSeoCompetitorKeyword[],
): DataForSeoCompetitorKeyword[] {
  return rows.filter((row) => isRelevantCompetitorKeyword(row.keyword));
}

export function isRelevantCompetitorKeyword(keyword: string): boolean {
  return !isLowFitCompetitorKeyword(keyword) && isActionableCompetitorKeyword(keyword);
}

export function isLowFitCompetitorKeyword(keyword: string): boolean {
  return /(history|origin|invented|tom blake|free surfers|freesurf|surfer best|surf fishing|fishing|boating|boat|ho stevie|george greenough|dylan graves)/i.test(keyword);
}

export function isActionableCompetitorKeyword(keyword: string): boolean {
  if (/(surfline|lazy surfer|swellify|swell scope|swellscope|duune|surf radar|magicseaweed|msw)/i.test(keyword)) {
    return false;
  }
  if (/^(surf|surfing|surfs)$/i.test(keyword.trim())) {
    return false;
  }
  return /(surf forecast|surf report|forecast|report|conditions|swell|wave forecast|wave period|wave height|tide|wind|buoy|water temp|water temperature|ocean temp|sea temp|how to read|beginner surf|best time to surf|dawn patrol|surf session|surf journal|surf tracker|surfboard|surf board|learn surf)/i.test(keyword);
}

export function classifyCompetitorKeyword(keyword: string): string {
  const value = keyword.toLowerCase();
  if (/(surfline|lazy surfer|swellify|swell scope|swellscope|duune|surf radar|magicseaweed|msw)/.test(value)) {
    return "competitor-brand";
  }
  if (/(water temp|water temperature|ocean temp|sea temperature)/.test(value)) {
    return "water-temp";
  }
  if (/(forecast|report|conditions|wave|swell|tide|wind|buoy)/.test(value)) {
    return "forecast-report";
  }
  if (/(beginner|learn|how to|what is|why|when|best time|history|origin)/.test(value)) {
    return "education";
  }
  if (/(session|journal|tracker|log|dawn patrol|board)/.test(value)) {
    return "session-memory";
  }
  if (/(beach|pier|point|cove|break|tamarack|malibu|scripps|tourmaline|huntington|rincon|kona|santa cruz|newport|la jolla)/.test(value)) {
    return "spot-local";
  }
  return "other";
}
