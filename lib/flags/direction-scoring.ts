const DEFAULT_EXCLUDED_SLUGS = ['avalanche', 'imperial-beach-pier'] as const;

function envSlugs(name: string): Set<string> | null {
  const value = process.env[name];
  if (value == null) return null;
  return new Set(value.split(',').map((slug) => slug.trim()).filter(Boolean));
}

export const DIRECTION_SCORING_EXCLUDED_SLUGS: ReadonlySet<string> = new Set(
  DEFAULT_EXCLUDED_SLUGS,
);

export function isDirectionScoringEnabledForBeach(
  beach: { slug?: string | null; shoaling_factors?: unknown },
): boolean {
  if (process.env.DIRECTION_SCORING_ENABLED !== 'true') return false;
  if (beach.shoaling_factors == null || !beach.slug) return false;

  const allowed = envSlugs('DIRECTION_SCORING_ALLOWED_SLUGS');
  if (allowed && !allowed.has(beach.slug)) return false;

  const excluded = envSlugs('DIRECTION_SCORING_EXCLUDED_SLUGS') ?? DIRECTION_SCORING_EXCLUDED_SLUGS;
  return !excluded.has(beach.slug);
}
