/**
 * Session Share Types
 * Type definitions for social sharing functionality
 */

import type { SessionWithDetails } from "./database";

/**
 * Share card visual variants (1-6)
 * Based on Figma designs
 */
export type ShareVariant = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Aspect ratios for share images
 * - 1:1 - Square (1080x1080) - Instagram post, Twitter
 * - 4:5 - Portrait (1080x1350) - Instagram feed
 * - 9:16 - Story (1080x1920) - Instagram/Facebook stories
 * - 16:9 - Landscape (1200x630) - OpenGraph (Twitter/Facebook link previews)
 */
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

/**
 * Social media platforms
 */
export type SharePlatform =
  | "instagram"
  | "x"
  | "facebook"
  | "generic"
  | "download";

/**
 * Variant names for reference
 */
export const VARIANT_NAMES: Record<ShareVariant, string> = {
  1: "Classic Overlay",
  2: "Split Layout",
  3: "Minimal Dark",
  4: "Glass Morphism",
  5: "Info Grid",
  6: "Card Overlay",
};

/**
 * Variant descriptions
 */
export const VARIANT_DESCRIPTIONS: Record<ShareVariant, string> = {
  1: "Image background with gradient overlay",
  2: "Image top, content bottom",
  3: "Cyan accent border with dark theme",
  4: "Gradient with glassmorphic elements",
  5: "Structured layout with bold borders",
  6: "White card on image background",
};

/**
 * Aspect ratio dimensions (in pixels)
 */
export const ASPECT_RATIO_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number }
> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1200, height: 630 },
};

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<SharePlatform, string> = {
  instagram: "Instagram",
  x: "X (Twitter)",
  facebook: "Facebook",
  generic: "Share Link",
  download: "Download Image",
};

/**
 * Props for SurfSessionCard component
 */
export interface SurfSessionCardProps {
  session: SessionWithDetails;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
  backgroundImage?: string;
  className?: string;
}

/**
 * Share options for ShareBar component
 */
export interface ShareOptions {
  sessionId: string;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
}

/**
 * Share event data for analytics
 */
export interface ShareEvent {
  sessionId: string;
  userId: string;
  platform: SharePlatform;
  variant: ShareVariant;
  aspectRatio: AspectRatio;
  shareUrl?: string;
}

/**
 * Share text template data
 */
export interface ShareTextData {
  beachName: string;
  date: string;
  waveHeight: string;
  wind: string;
  rating: number;
}

/**
 * Share URL builder result
 */
export interface ShareURL {
  url: string;
  text?: string;
  tooltip?: string;
}

/**
 * Image generation result
 */
export interface GeneratedImage {
  png: Uint8Array;
  width: number;
  height: number;
  url?: string;
}

/**
 * Share tracking result
 */
export interface ShareTrackingResult {
  success: boolean;
  shareId?: string;
  error?: string;
}

/**
 * Helper type for session data used in share text
 */
export interface SessionShareData {
  id: string;
  beaches: {
    name: string;
  } | null;
  arrival_time: string;
  rating: number | null;
  wave_quality: number | null;
  notes: string | null;
  description: string | null;
}

/**
 * Default variant by theme
 */
export const DEFAULT_VARIANT_BY_THEME: Record<"light" | "dark", ShareVariant> =
  {
    light: 1,
    dark: 3,
  };

/**
 * File size targets (in bytes)
 */
export const FILE_SIZE_TARGETS: Record<AspectRatio, number> = {
  "1:1": 350 * 1024, // 350KB
  "4:5": 350 * 1024, // 350KB
  "9:16": 500 * 1024, // 500KB
  "16:9": 300 * 1024, // 300KB (smaller due to landscape format)
};

/**
 * Type guard to check if a value is a valid ShareVariant
 */
export function isShareVariant(value: unknown): value is ShareVariant {
  return typeof value === "number" && value >= 1 && value <= 6;
}

/**
 * Type guard to check if a value is a valid AspectRatio
 */
export function isAspectRatio(value: unknown): value is AspectRatio {
  return (
    typeof value === "string" &&
    ["1:1", "4:5", "9:16", "16:9"].includes(value as string)
  );
}

/**
 * Type guard to check if a value is a valid SharePlatform
 */
export function isSharePlatform(value: unknown): value is SharePlatform {
  return (
    typeof value === "string" &&
    ["instagram", "x", "facebook", "generic", "download"].includes(
      value as string
    )
  );
}
