"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, MapPin, Star, Waves } from "lucide-react";
import { getBlurPlaceholder } from "@/lib/constants/blur-placeholders";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";

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
  delay = 0,
}: SurfSpotCardProps) {
  // Track image load errors to show fallback
  const [imageError, setImageError] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Generate beach URL using hierarchical format if data available, otherwise fall back to ID
  const beachUrl = getBeachUrlSafe({ id, slug, city, state }) || `/beach/${id}`;

  // Show fallback if no imageUrl or if image failed to load
  const showFallback = !imageUrl || imageError;

  const returnTo = (() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const handleSaveClick = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.KeyboardEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    router.push(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <div
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay * 100}ms`, animationFillMode: "both" }}
    >
      <Link href={beachUrl} prefetch={false} className="block group">
        <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          {/* Image Section */}
          <div className="relative h-48 bg-gradient-to-br from-ocean-blue to-blue-400 overflow-hidden">
            {/* Save button (guests -> login flow) */}
            <button
              type="button"
              aria-label={`Save ${name}`}
              onClick={handleSaveClick}
              className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm hover:bg-white transition-colors"
            >
              <Bookmark className="h-5 w-5 text-dark-grey" />
            </button>

            {!showFallback ? (
              <Image
                src={imageUrl}
                alt={name}
                fill
                loading="lazy"
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                placeholder={getImagePlaceholder(imageUrl) ? "blur" : "empty"}
                blurDataURL={getImagePlaceholder(imageUrl)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Waves className="h-16 w-16 text-white/40" />
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4">
            {/* Name and Location */}
            <h3 className="text-lg font-bold font-roboto text-dark-grey mb-1 group-hover:text-ocean-blue transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>

            {/* Rating + Skill level */}
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Star
                  className="h-3.5 w-3.5 text-gray-700"
                  aria-hidden="true"
                />
                <span className="font-medium text-gray-800">
                  {typeof averageRating === "number"
                    ? averageRating.toFixed(1)
                    : "New"}
                </span>
                {typeof reviewCount === "number" && reviewCount > 0 ? (
                  <span className="text-gray-500">({reviewCount})</span>
                ) : null}
              </div>
              <span className="text-gray-300">•</span>
              <span className="text-gray-700">
                {formatSkillLevel(skillLevel)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
