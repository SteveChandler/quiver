/**
 * SurfSessionCard Component
 * Renders session summary cards in 6 visual variants for social sharing
 * Supports 3 aspect ratios: 1:1 (square), 4:5 (portrait), 9:16 (story)
 */

"use client";

import type { SurfSessionCardProps, AspectRatio } from "@/types/session-share";
import { ASPECT_RATIO_DIMENSIONS } from "@/types/session-share";
import { formatRatingAsStars } from "@/lib/share/share-text-builder";
import { format } from "date-fns";
import { Waves as WavesIcon, Wind as WindIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Custom hook to extract and format session data
 * Eliminates duplication of data parsing across all variants
 */
function useSessionData(session: SurfSessionCardProps["session"]) {
  return {
    beachName: session.beaches?.name || "Unknown Beach",
    date: format(new Date(session.arrival_time), "MMM d, yyyy"),
    rating: session.rating || 0,
    waveHeight: "4-6 ft", // Simplified for design
    wind: "5-10 mph",
    notes: session.notes || session.description || "Perfect morning session! Glassy conditions with consistent sets. Caught some amazing rides on the point break.",
  };
}

/**
 * QuiverSurf Logo Component (inline SVG)
 */
function QuiverSurfLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
        <WavesIcon className="w-5 h-5 text-white" />
      </div>
      <span className="font-bold text-lg">QuiverSurf</span>
    </div>
  );
}

/**
 * Star Rating Display
 */
function StarRating({ rating, className }: { rating: number; className?: string }) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));

  return (
    <div className={cn("flex gap-1", className)}>
      {stars.map((filled, i) => (
        <span key={i} className={filled ? "text-yellow-400" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

/**
 * CTA Button Component
 * Supports multiple style variants for different card designs
 */
type CTAStyle = "white-on-black" | "black-on-white" | "cyan" | "blue" | "bold-black" | "rounded-xl";

function CTAButton({ style = "white-on-black", className }: { style?: CTAStyle; className?: string }) {
  const baseClasses = "py-3 px-6 text-center font-semibold";

  const styleClasses = {
    "white-on-black": "bg-white text-black rounded-lg",
    "black-on-white": "bg-black text-white rounded-lg",
    "cyan": "bg-cyan-400 text-black rounded-lg font-bold",
    "blue": "bg-white text-blue-600 rounded-2xl font-bold shadow-xl",
    "bold-black": "bg-black text-white border-4 border-black uppercase tracking-wide font-black",
    "rounded-xl": "bg-black text-white rounded-xl",
  };

  return (
    <div className={cn(baseClasses, styleClasses[style], className)}>
      Track your sessions at quiversurf.app
    </div>
  );
}

/**
 * Condition Badge Components
 * Reusable wave/wind condition displays
 */
function ConditionBadges({
  waveHeight,
  wind,
  className
}: {
  waveHeight: string;
  wind: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-4", className)}>
      <div className="flex items-center gap-2 text-lg">
        <WavesIcon className="w-6 h-6" />
        <span>{waveHeight}</span>
      </div>
      <div className="flex items-center gap-2 text-lg">
        <WindIcon className="w-6 h-6" />
        <span>{wind}</span>
      </div>
    </div>
  );
}

/**
 * Condition Cards for grid layouts (Variant 3, 4, 5)
 */
type ConditionCardStyle = "minimal-dark" | "glass" | "bold-grid";

function ConditionCards({
  waveHeight,
  wind,
  style
}: {
  waveHeight: string;
  wind: string;
  style: ConditionCardStyle;
}) {
  const cardClasses = {
    "minimal-dark": "bg-gray-900 border border-cyan-400/30 rounded-lg p-6",
    "glass": "bg-white/30 backdrop-blur-sm rounded-2xl p-5 border border-white/40",
    "bold-grid": "border-4 border-black p-5",
  };

  const labelClasses = {
    "minimal-dark": "flex items-center gap-2 text-cyan-400 mb-2",
    "glass": "text-sm opacity-90 mb-1",
    "bold-grid": "text-sm font-bold mb-1 uppercase tracking-wide",
  };

  const valueClasses = {
    "minimal-dark": "text-2xl font-bold",
    "glass": "text-2xl font-bold",
    "bold-grid": "text-3xl font-black",
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className={cardClasses[style]}>
        {style === "minimal-dark" && (
          <div className={labelClasses[style]}>
            <WavesIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Wave Height</span>
          </div>
        )}
        {style !== "minimal-dark" && (
          <p className={labelClasses[style]}>Waves</p>
        )}
        <p className={valueClasses[style]}>{waveHeight}</p>
      </div>
      <div className={cardClasses[style]}>
        {style === "minimal-dark" && (
          <div className={labelClasses[style]}>
            <WindIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Wind</span>
          </div>
        )}
        {style !== "minimal-dark" && (
          <p className={labelClasses[style]}>Wind</p>
        )}
        <p className={valueClasses[style]}>{wind}</p>
      </div>
    </div>
  );
}

/**
 * Variant 1: Classic Overlay
 * Image background with gradient overlay and white text
 */
function Variant1({
  session,
  aspectRatio,
  backgroundImage,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundImage
            ? `url(${backgroundImage})`
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Content */}
      <div className="relative h-full flex flex-col p-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between">
          <QuiverSurfLogo className="text-white" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-end">
          <h1 className="text-5xl font-bold mb-2">{beachName}</h1>
          <p className="text-xl flex items-center gap-2 mb-6">
            <span>📅</span>
            <span>{date}</span>
          </p>

          {/* Conditions */}
          <ConditionBadges waveHeight={waveHeight} wind={wind} className="mb-6" />

          {/* Rating */}
          <StarRating rating={rating} className="mb-4 text-3xl" />

          {/* Notes (only show if aspect ratio allows) */}
          {aspectRatio !== "1:1" && (
            <p className="text-lg opacity-90 line-clamp-2 mb-6">{notes}</p>
          )}

          {/* CTA */}
          <CTAButton style="white-on-black" />
        </div>
      </div>
    </div>
  );
}

/**
 * Variant 2: Split Layout
 * Image on top, content on bottom
 */
function Variant2({
  session,
  aspectRatio,
  backgroundImage,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
  const imageHeight = aspectRatio === "1:1" ? "50%" : aspectRatio === "4:5" ? "45%" : "40%";

  return (
    <div
      className="relative overflow-hidden bg-gray-50"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Image Section */}
      <div
        className="relative bg-cover bg-center"
        style={{
          height: imageHeight,
          backgroundImage: backgroundImage
            ? `url(${backgroundImage})`
            : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        }}
      >
        {/* Wave/Wind badges on image */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <div className="bg-gray-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
            {waveHeight}
          </div>
          <div className="bg-gray-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium">
            {wind}
          </div>
        </div>

        {/* Preview badge */}
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded text-xs font-semibold text-gray-700">
          Preview
        </div>
      </div>

      {/* Content Section */}
      <div className="p-8 flex flex-col justify-between" style={{ height: `calc(100% - ${imageHeight})` }}>
        <div>
          <div className="flex items-center gap-3 mb-4">
            <QuiverSurfLogo className="text-cyan-600" />
          </div>

          <h1 className="text-4xl font-bold text-gray-900 mb-2">{beachName}</h1>
          <p className="text-gray-600 text-lg mb-4">{date}</p>

          <StarRating rating={rating} className="mb-4 text-2xl" />

          {aspectRatio === "9:16" && (
            <p className="text-gray-700 line-clamp-3 mb-4">{notes}</p>
          )}
        </div>

        <CTAButton style="black-on-white" />
      </div>
    </div>
  );
}

/**
 * Variant 3: Minimal Dark
 * Cyan border with dark theme - matches Figma "Minimal Dark" design
 */
function Variant3({
  session,
  aspectRatio,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return (
    <div
      className="relative overflow-hidden bg-black"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Cyan border */}
      <div className="absolute inset-0 border-4 border-cyan-400" />

      {/* Content */}
      <div className="relative h-full flex flex-col p-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <QuiverSurfLogo className="text-white" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <h1 className="text-5xl font-bold mb-4">{beachName}</h1>
          <p className="text-xl text-gray-300 mb-8">{date}</p>

          {/* Condition Cards */}
          <div className="mb-8">
            <ConditionCards waveHeight={waveHeight} wind={wind} style="minimal-dark" />
          </div>

          {/* Rating */}
          <div className="mb-6">
            <p className="text-sm text-cyan-400 font-medium mb-2">Rating</p>
            <StarRating rating={rating} className="text-3xl" />
          </div>

          {/* Notes */}
          {aspectRatio !== "1:1" && (
            <p className="text-gray-300 line-clamp-2 mb-auto">{notes}</p>
          )}

          {/* CTA */}
          <CTAButton style="cyan" className="mt-8" />
        </div>
      </div>
    </div>
  );
}

/**
 * Variant 4: Glass Morphism
 * Blue gradient with glassmorphic elements
 */
function Variant4({
  session,
  aspectRatio,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-cyan-500 to-teal-500" />

      {/* Content */}
      <div className="relative h-full flex flex-col p-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <QuiverSurfLogo className="text-white drop-shadow-lg" />
          <StarRating rating={rating} className="text-2xl drop-shadow-lg" />
        </div>

        {/* Main Content Card */}
        <div className="flex-1 flex flex-col">
          <div className="bg-white/20 backdrop-blur-md rounded-3xl p-8 border border-white/30 shadow-2xl">
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">{beachName}</h1>
            <p className="text-xl mb-8 drop-shadow">{date}</p>

            {/* Condition Cards */}
            <div className="mb-6">
              <ConditionCards waveHeight={waveHeight} wind={wind} style="glass" />
            </div>

            {aspectRatio !== "1:1" && (
              <p className="text-white/90 line-clamp-2 drop-shadow">{notes}</p>
            )}
          </div>

          {/* CTA */}
          <CTAButton style="blue" className="mt-6" />
        </div>
      </div>
    </div>
  );
}

/**
 * Variant 5: Info Grid
 * Structured layout with bold borders
 */
function Variant5({
  session,
  aspectRatio,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return (
    <div
      className="relative overflow-hidden bg-white"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Bold border frame */}
      <div className="absolute inset-0 border-8 border-black" />

      {/* Content */}
      <div className="relative h-full flex flex-col p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b-4 border-black mb-6">
          <QuiverSurfLogo className="text-black" />
          <StarRating rating={rating} className="text-2xl text-yellow-500" />
        </div>

        {/* Beach Info */}
        <div className="border-4 border-black p-6 mb-6">
          <h1 className="text-4xl font-black mb-2">{beachName}</h1>
          <p className="text-xl font-bold">{date}</p>
        </div>

        {/* Conditions Grid */}
        <div className="mb-6">
          <ConditionCards waveHeight={waveHeight} wind={wind} style="bold-grid" />
        </div>

        {/* Notes */}
        {aspectRatio !== "1:1" && (
          <div className="border-4 border-black p-5 mb-6">
            <p className="font-medium line-clamp-2">{notes}</p>
          </div>
        )}

        {/* CTA */}
        <CTAButton style="bold-black" className="mt-auto" />
      </div>
    </div>
  );
}

/**
 * Variant 6: Card Overlay
 * White card on image background
 */
function Variant6({
  session,
  aspectRatio,
  backgroundImage,
}: SurfSessionCardProps) {
  const { beachName, date, rating, waveHeight, wind, notes } = useSessionData(session);
  const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: backgroundImage
            ? `url(${backgroundImage})`
            : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col p-8">
        {/* Header with logo */}
        <div className="flex items-center justify-between mb-auto">
          <QuiverSurfLogo className="text-white drop-shadow-lg" />
          <div className="bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1 rounded text-sm">
            {date}
          </div>
        </div>

        {/* White Content Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{beachName}</h1>

          {/* Conditions */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <WavesIcon className="w-5 h-5 text-cyan-600" />
              <span className="font-semibold">{waveHeight}</span>
            </div>
            <div className="flex items-center gap-2">
              <WindIcon className="w-5 h-5 text-cyan-600" />
              <span className="font-semibold">{wind}</span>
            </div>
          </div>

          {/* Rating */}
          <StarRating rating={rating} className="mb-4 text-2xl text-yellow-500" />

          {/* Notes */}
          {aspectRatio !== "1:1" && (
            <p className="text-gray-700 line-clamp-2 mb-6">{notes}</p>
          )}

          {/* CTA */}
          <CTAButton style="rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main SurfSessionCard Component
 * Routes to the appropriate variant
 */
export default function SurfSessionCard(props: SurfSessionCardProps) {
  const { variant } = props;

  switch (variant) {
    case 1:
      return <Variant1 {...props} />;
    case 2:
      return <Variant2 {...props} />;
    case 3:
      return <Variant3 {...props} />;
    case 4:
      return <Variant4 {...props} />;
    case 5:
      return <Variant5 {...props} />;
    case 6:
      return <Variant6 {...props} />;
    default:
      return <Variant1 {...props} />;
  }
}
