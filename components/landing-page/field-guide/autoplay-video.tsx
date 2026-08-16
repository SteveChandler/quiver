"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";

interface AutoplayVideoProps {
  src: string;
  ariaLabel: string;
  className?: string;
  poster?: string;
  /** Label for the reduced-motion fallback control. */
  playLabel?: string;
  playButtonClassName?: string;
}

/**
 * Muted, looping video that starts on its own for viewers who allow motion and
 * degrades to an explicit play control for viewers who do not.
 */
export function AutoplayVideo({
  src,
  ariaLabel,
  className,
  poster,
  playLabel = "Play video",
  playButtonClassName,
}: AutoplayVideoProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion === true;
  const shouldAutoplay = prefersReducedMotion === false;
  const [hasStarted, setHasStarted] = useState(false);

  const playVideo = useCallback((): void => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const playResult = video.play();
      if (playResult && typeof playResult.then === "function") {
        void playResult.then(() => setHasStarted(true)).catch(() => undefined);
        return;
      }
      setHasStarted(true);
    } catch {
      setHasStarted(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldAutoplay) return;
    playVideo();
  }, [playVideo, shouldAutoplay]);

  return (
    <>
      {/* Autoplay is driven from the effect above, not the attribute:
          useReducedMotion() is null during SSR, so a rendered autoPlay value
          differs between server and client and breaks hydration. */}
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={ariaLabel}
        className={className}
      />
      {shouldReduceMotion && !hasStarted ? (
        <button type="button" onClick={playVideo} className={playButtonClassName}>
          {playLabel}
        </button>
      ) : null}
    </>
  );
}
