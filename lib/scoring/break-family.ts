type BreakFamily = 'beach' | 'reef' | 'point' | (string & {});

const BEACH_TOKENS = new Set(['beach', 'pier', 'jetty', 'breakwater', 'inlet', 'river-mouth']);

export function breakTypeFamilies(raw: string | null | undefined): readonly BreakFamily[] | null {
  const families = raw?.toLowerCase().split('/')
    .map((part) => part.trim().replace(/ break$/, '').trim())
    .filter(Boolean)
    .map((part) => BEACH_TOKENS.has(part) ? 'beach' : part);
  return families?.length ? [...new Set(families)] : null;
}

export function breakTypesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = breakTypeFamilies(a);
  const right = breakTypeFamilies(b);
  return !left || !right || left.some((family) => right.includes(family));
}
