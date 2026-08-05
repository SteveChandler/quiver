interface BeachSlugOption {
  slug: string;
}

// `beaches[0]` is arbitrary and previously selected a beach with no conditions data.
export const DEFAULT_PREVIEW_SLUG = "huntington-beach-pier";

export function validateInitialBeachSlug(
  beaches: readonly BeachSlugOption[],
  requestedSlug: string | string[] | undefined
): string | undefined {
  if (typeof requestedSlug !== "string") return undefined;

  return beaches.some((beach) => beach.slug === requestedSlug)
    ? requestedSlug
    : undefined;
}

export function resolvePreviewSlug(
  beaches: readonly BeachSlugOption[],
  initialSlug?: string
): string {
  const validatedInitialSlug = validateInitialBeachSlug(beaches, initialSlug);
  if (validatedInitialSlug) return validatedInitialSlug;

  const defaultBeach = beaches.find(
    (beach) => beach.slug === DEFAULT_PREVIEW_SLUG
  );
  if (defaultBeach) return defaultBeach.slug;

  return beaches[0]?.slug ?? DEFAULT_PREVIEW_SLUG;
}
