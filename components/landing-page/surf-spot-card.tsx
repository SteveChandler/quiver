"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Star, Waves } from "lucide-react";
import { getBlurPlaceholder } from "@/lib/constants/blur-placeholders";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";

export interface SurfSpotCardProps {
  id: string;
  name: string;
  location: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  imageUrl?: string | null;
  averageRating?: number | null;
  reviewCount?: number | null;
  skillLevel?: string | null;
  score?: number | null;
  waveHeight?: number | null;
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

export function SurfSpotCard({
  id,
  name,
  location,
  slug,
  city,
  state,
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

  // Generate beach URL using hierarchical format with safe fallback chain
  const beachUrl = getBeachHrefSafe({ id, slug, city, state }) || "/";

  // Show fallback if no imageUrl or if image failed to load
  const showFallback = !imageUrl || imageError;

  const handleSaveClick = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const returnTo = window.location.pathname + window.location.search;
    router.push(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div
      className="animate-fade-in-up h-full"
      style={{ animationDelay: `${delay * 100}ms`, animationFillMode: "both" }}
    >
      <Link href={beachUrl} prefetch={false} className="block group h-full">
        {/* AllTrails-style card: rounded-2xl, subtle shadow transition */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
          {/* Image Section */}
          <div className="relative h-44 bg-gray-100 overflow-hidden rounded-t-2xl">
            {/* Score badge - top-left corner of image */}
            {typeof score === 'number' && score > 0 && (
              <div className={`absolute top-3 left-3 z-10 inline-flex items-center justify-center h-8 min-w-[2rem] px-1.5 rounded-full text-xs font-bold text-white ${getScoreColorClasses(score).bg}`}>
                {score}
              </div>
            )}

            {/* Save/bookmark button - top-right corner of image */}
            <button
              type="button"
              aria-label={`Save ${name}`}
              onClick={handleSaveClick}
              className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm hover:bg-white hover:shadow-md transition-all"
            >
              <Bookmark className="h-4 w-4 text-gray-600" />
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
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                <Waves className="h-12 w-12 text-slate-300" />
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4 flex-1">
            {/* Name */}
            <h3 className="text-base font-semibold font-roboto text-gray-900 mb-1 line-clamp-1">
              {name}
            </h3>

            {/* Meta row - AllTrails style: Wave Height · Rating · Type · Location */}
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-sm text-gray-600">
              {/* Wave height */}
              {typeof waveHeight === 'number' && waveHeight > 0 && (
                <>
                  <span className="flex items-center gap-0.5">
                    <Waves className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-medium text-gray-800">{Math.round(waveHeight)}ft</span>
                  </span>
                  <span className="text-gray-300">·</span>
                </>
              )}
              {/* Rating */}
              <div className="flex items-center gap-0.5">
                <Star
                  className="h-3.5 w-3.5 text-gray-700 fill-gray-700"
                  aria-hidden="true"
                />
                <span className="font-medium text-gray-800">
                  {typeof averageRating === "number"
                    ? averageRating.toFixed(1)
                    : "New"}
                </span>
                {typeof reviewCount === "number" && reviewCount > 0 && (
                  <span className="text-gray-500">({reviewCount})</span>
                )}
              </div>
              <span className="text-gray-300">·</span>
              {/* Skill level */}
              <span className="text-gray-600">
                {formatSkillLevel(skillLevel)}
              </span>
              <span className="text-gray-300">·</span>
              {/* Location */}
              <span className="text-gray-600 truncate">{location}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
