"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { NativeAppFunnelCta } from "@/components/app-store/native-app-funnel-cta";
import { CommunityPhotoUpload } from "@/components/media/community-photo-upload";
import { SessionVideoUpload } from "@/components/media/session-video-upload";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";

export interface PostSessionShareProps {
  /** Beach name to display */
  beachName: string;
  /** Overall session rating (1–5) */
  overallRating: number;
  /** Wave size description (e.g. "Waist-Chest") */
  waveSize: string;
  /** Called when the user taps "Share Your Session" */
  onShare: () => void;
  /** Called when the user taps "Skip" */
  onSkip: () => void;
  /**
   * Fully-qualified URL to the OG session card image (e.g. /api/og/session?…).
   * When provided, a visual preview of the share card is rendered above the CTAs
   * so users see exactly what they're sharing before they tap.
   */
  shareCardUrl?: string;
  /** Session/beach context used by the post-session UGC uploads. */
  beachId?: string;
  sessionId?: string;
  initialPhoto?: File | null;
}

/**
 * Full-screen celebration overlay shown after logging a session.
 * Fires canvas-confetti once on mount (skipped for prefers-reduced-motion).
 * Renders a dialog with an OG share card preview (when shareCardUrl is provided),
 * beach name, star rating, wave size, and Share / Skip CTAs.
 */
export function PostSessionShare({
  beachName,
  overallRating,
  waveSize,
  onShare,
  onSkip,
  shareCardUrl,
  beachId,
  sessionId,
  initialPhoto = null,
}: PostSessionShareProps) {
  const clampedRating = Math.max(0, Math.min(5, Math.round(overallRating)));
  const reducedMotion = useReducedMotion();
  const [cardImageLoaded, setCardImageLoaded] = useState(false);
  const [nativeCtaPlatform, setNativeCtaPlatform] =
    useState<FirstTouchPlatform>("desktop");

  useEffect(() => {
    setNativeCtaPlatform(getFirstTouchPlatform());
  }, []);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced) return;

    // Dynamic import keeps confetti out of the initial bundle
    import("canvas-confetti")
      .then(({ default: confetti }) => {
        confetti({ particleCount: 140, spread: 70, origin: { y: 0.6 } });
      })
      .catch(() => {
        // Non-fatal — celebration degrades gracefully without confetti
      });
  }, []);

  // Keyboard: Escape dismisses the dialog, matching aria-modal expectations.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onSkip();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onSkip]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session logged — share your session"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#0d1f2d] via-[#1a3a4a] to-[#0d1f2d] px-6 overflow-y-auto"
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center gap-6 w-full max-w-sm text-center py-8"
      >
        {/* Headline */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl font-extrabold text-white tracking-tight">
            Session Logged
          </span>
          <span className="text-lg font-medium text-white/70">{beachName}</span>
        </div>

        {/* Star rating */}
        <div
          aria-label={`${clampedRating} out of 5 stars`}
          className="flex items-center gap-1"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <svg
              key={i}
              aria-hidden="true"
              width={32}
              height={32}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={i < clampedRating ? "#FFD700" : "rgba(255,255,255,0.28)"}
              />
            </svg>
          ))}
        </div>

        {/* Wave size */}
        {waveSize ? (
          <span className="text-base font-semibold text-white/80 uppercase tracking-widest">
            {waveSize}
          </span>
        ) : null}

        {beachId ? (
          <CommunityPhotoUpload
            targetType="beach"
            targetId={beachId}
            initialFile={initialPhoto}
            className="w-full text-left"
          />
        ) : null}

        {sessionId ? <SessionVideoUpload sessionId={sessionId} className="w-full text-left" /> : null}

        {/* OG share card preview — hero of the celebration when available */}
        {shareCardUrl ? (
          <div className="w-full flex flex-col items-center gap-3">
            {/* Microcopy */}
            <p className="text-sm font-semibold text-[#F78E42] uppercase tracking-widest">
              Your session card is ready to share
            </p>

            {/* Card preview container — 9:16 aspect ratio (1080×1920) */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-white/10"
              style={{ aspectRatio: "9 / 16" }}
            >
              {/* Loading skeleton — shown until the image fires onLoad */}
              {!cardImageLoaded && (
                <div
                  data-testid="share-card-loading"
                  className="absolute inset-0 bg-gradient-to-b from-[#252D6B] to-[#1E2558] animate-pulse"
                  aria-hidden="true"
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- OG images use img for Next.js edge compatibility */}
              <img
                src={shareCardUrl}
                alt="Session share card preview"
                onLoad={() => setCardImageLoaded(true)}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : null}

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={onShare}
              className="w-full rounded-2xl bg-[#F78E42] px-4 py-4 text-base font-bold text-[#11100D] transition-colors hover:bg-[#D57835] active:bg-[#C06A25] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1535]"
          >
            Share Your Session
          </button>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-left">
            <p className="text-sm font-semibold text-white">
              Log the next one at the beach.
            </p>
            <p className="mt-1 text-xs leading-5 text-white/65">
              Get Quiver on your phone for faster session logging after you paddle in.
            </p>
            <NativeAppFunnelCta
              platform={nativeCtaPlatform}
              source="post_session_log"
              surface="session_log_success"
              placement="native_app_nudge"
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#252D6B] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              desktopClassName="mt-3"
              desktopShowEmailForm={false}
              iosLabel="Get Quiver on iPhone"
              androidLabel="Get the Android beta"
            />
          </div>
          <button
            onClick={onSkip}
            className="w-full rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white/70 font-medium text-base py-3.5 transition-colors focus-ring"
          >
            Skip
          </button>
        </div>
      </motion.div>
    </div>
  );
}
