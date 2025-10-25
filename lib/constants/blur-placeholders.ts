// lib/constants/blur-placeholders.ts
/**
 * Blur placeholder data URLs for hero images
 * Generated with: node scripts/generate-blur-placeholders.mjs
 * DO NOT EDIT MANUALLY - regenerate using the script
 */
export const BLUR_PLACEHOLDERS = {
  "On_the_Beach_at_Bandon": "data:image/webp;base64,UklGRjQAAABXRUJQVlA4ICgAAAAQAgCdASoKAAcABUB8JYwCdIExE6WHqZwAAM2R7s+lCAuan+nImAAA",
  "Agate_Beach_Marin_County_California": "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAACQAQCdASoKAAYABUB8JYwCdADzAgAAzZKo34lsAzxqW3WAAAA=",
  "Beacons_Beach": "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoKAAcABUB8JQBOgBPYAADmK3qAUWYiy3ge4AgAAAA=",
  "blacks": "data:image/webp;base64,UklGRi4AAABXRUJQVlA4ICIAAABwAQCdASoKAAYADkB8JZwC7AFAAAD+6lIQ8u1fdko3AAAA",
  "Winter-Swamis": "data:image/webp;base64,UklGRjAAAABXRUJQVlA4ICQAAACwAQCdASoKAAgABUB8JZQCdAEOuDHYAP5WtlxsMUuNEyrsAAA=",
  "windandsea-surf-shack-sunset": "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAACwAQCdASoKAAUABUB8JaACsADyfvaAAMnhmPY2w+C22KvlnQwAAA==",
  "OceanBeachSurfers": "data:image/webp;base64,UklGRjIAAABXRUJQVlA4ICYAAACwAQCdASoKAAgABUB8JQBOgCHXgLcAAP6Rn4ILPhB2Bo1Cv8AAAA==",
} as const;

export type BlurPlaceholderKey = keyof typeof BLUR_PLACEHOLDERS;

/**
 * Get blur placeholder for an image by filename (without extension)
 * @param filename - Image filename without extension
 * @returns Base64 data URL for blur placeholder
 */
export function getBlurPlaceholder(filename: string): string | undefined {
  return BLUR_PLACEHOLDERS[filename as BlurPlaceholderKey];
}
