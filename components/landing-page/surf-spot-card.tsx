"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Star, Waves } from "lucide-react";
import { getBlurPlaceholder } from "@/lib/constants/blur-placeholders";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { formatWaveHeightRange as formatWaveHeight } from "@/lib/formatters/surf-data";

export interface SurfSpotCardProps {
  id: string;
  name: string;
  location: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  imageUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  skillLevel?: string | null;
  score?: number | null;
  waveHeight?: string | number | null;
  swellHeight?: string;
  swellDirection?: string;
  windSpeed?: string;
  tideStatus?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  crowdLevel?: "Uncrowded" | "Moderate" | "Crowded";
  delay?: number;
}

/**
 * Get blur placeholder for an image URL
 * Extracts filename from URL and looks up the placeholder
 */
function getImagePlaceholder(imageUrl: string): string | undefined {
  // Extract filename without extension from image URL
  const filename = imageUrl
    .split("/")
    .pop()
    ?.replace(/\.(webp|jpg|jpeg|png)$/i, "");

  return filename ? getBlurPlaceholder(filename) : undefined;
}

function formatSkillLevel(value?: string | null): string {
  if (!value) return "All levels";
  const cleaned = value.trim();
  if (!cleaned) return "All levels";
  // Normalize common values like "beginner", "intermediate", "advanced", "expert"
  return cleaned
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSkillHelpText(value?: string | null): string {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("beginner")) return "Good starter option";
  if (normalized.includes("intermediate")) return "Some experience helps";
  if (normalized.includes("advanced") || normalized.includes("expert")) {
    return "Confident surfers only";
  }
  return "Check the local notes";
}

export function SurfSpotCard({
  id,
  name,
  location,
  slug,
  city,
  state,
  country,
  imageUrl,
  averageRating,
  reviewCount,
  skillLevel,
  score,
  waveHeight,
  delay = 0,
}: SurfSpotCardProps) {
  // Track image load errors to show fallback
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString() ? `?${searchParams.toString()}` : "";

  // Generate beach URL using hierarchical format with safe fallback chain
  const beachUrl = getBeachHrefSafe({ id, slug, city, state, country }) || "/";

  // Show fallback if no imageUrl or if image failed to load
  const showFallback = !imageUrl || imageError;

  const handleSaveClick = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const returnTo = pathname + searchParamsString;
    router.push(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div
      className="animate-fade-in-up h-full"
      style={{ animationDelay: `${delay * 100}ms`, animationFillMode: "both" }}
    >
      <Link href={beachUrl} prefetch={false} className="block group h-full">
        {/* Dark cyberpunk card */}
        <div className="bg-[#1E2558] rounded-2xl overflow-hidden shadow-none hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1 transition-[box-shadow,transform] duration-200 h-full flex flex-col glow-hover-cyan">
          {/* Image Section */}
          <div className="relative h-48 md:h-56 bg-[#171E45] overflow-hidden rounded-t-2xl">
            {/* Score badge - circular, top-left corner of image */}
            {typeof score === "number" && score > 0 && (
              <div
                className={`absolute top-3 left-3 z-10 inline-flex items-center justify-center h-10 w-10 rounded-[14px_7px_16px_7px] text-sm font-mono font-bold text-white shadow-[0_3px_0_rgba(0,0,0,0.35)] ${getScoreColorClasses(score).bg}`}
              >
                {score}
              </div>
            )}

            {/* Save/bookmark button - top-right corner of image */}
            <button
              type="button"
              aria-label={`Save ${name}`}
              onClick={handleSaveClick}
              className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 shadow-sm hover:bg-white/20 hover:shadow-md transition-[background-color,box-shadow] focus-ring"
            >
              <Bookmark className="h-4 w-4 text-white/70" />
            </button>

            {!showFallback ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                loading="lazy"
                className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                placeholder={getImagePlaceholder(imageUrl) ? "blur" : "empty"}
                blurDataURL={getImagePlaceholder(imageUrl)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1E2558] to-[#252D6B]">
                <Waves className="h-12 w-12 text-white/20" />
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 flex-1">
            <div className="mb-3 inline-flex flex-col rounded-[12px_5px_14px_6px] border border-[#F78E42]/30 bg-[#F78E42]/12 px-3 py-1.5">
              <span className="font-heading text-xs font-bold uppercase tracking-wide text-[#F78E42]">
                {formatSkillLevel(skillLevel)}
              </span>
              <span className="text-[11px] leading-tight text-white/55">
                {getSkillHelpText(skillLevel)}
              </span>
            </div>

            {/* Name */}
            <h3 className="text-base font-semibold font-sans text-white mb-1 line-clamp-1">
              {name}
            </h3>

            {/* Meta row */}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-sm text-white/60">
              {/* Wave height */}
              {(() => {
                const numericHeight = typeof waveHeight === "string" ? parseFloat(waveHeight) : waveHeight;
                if (numericHeight == null || !Number.isFinite(numericHeight) || numericHeight <= 0) return null;
                return (
                  <>
                    <span className="flex items-center gap-0.5">
                      <Waves className="h-3.5 w-3.5 text-cyan-400" />
                      <span className="font-medium text-white/80">
                        {typeof waveHeight === "string" ? `${Math.round(numericHeight)}ft` : formatWaveHeight(numericHeight)}
                      </span>
                    </span>
                    <span className="text-white/20">·</span>
                  </>
                );
              })()}
              {/* Rating */}
              <div className="flex items-center gap-0.5">
                <Star
                  className="h-3.5 w-3.5 text-white/70 fill-white/70"
                  aria-hidden="true"
                />
                <span className="font-medium text-white/80">
                  {typeof averageRating === "number"
                    ? averageRating.toFixed(1)
                    : "New"}
                </span>
                {typeof reviewCount === "number" && reviewCount > 0 && (
                  <span className="text-white/60">({reviewCount})</span>
                )}
              </div>
              {/* Location */}
              <span className="text-white/60 truncate">{location}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
