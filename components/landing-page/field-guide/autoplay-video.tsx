"use client";

import { useInView, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";

interface AutoplayVideoProps {
  src: string;
  ariaLabel: string;
  className?: string;
  poster?: string;
  /** Label for the motion/data-saving fallback control. */
  playLabel?: string;
  playButtonClassName?: string;
}

/**
 * Load visible video only when motion and data preferences allow autoplay.
 * Otherwise keep the poster until the viewer explicitly requests playback.
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
  const isInView = useInView(videoRef, { once: true });
  const [saveData, setSaveData] = useState<boolean | null>(null);
  const [requestedPlay, setRequestedPlay] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const shouldAutoplay = prefersReducedMotion === false && saveData === false;
  const shouldLoad = requestedPlay || (isInView && shouldAutoplay);

  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean };
    }).connection;
    setSaveData(connection?.saveData === true);
  }, []);

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
    if (!shouldLoad) return;
    playVideo();
  }, [playVideo, shouldLoad]);

  return (
    <>
      {/* Autoplay is driven from the effect above, not the attribute:
          useReducedMotion() is null during SSR, so a rendered autoPlay value
          differs between server and client and breaks hydration. */}
      <video
        ref={videoRef}
        src={shouldLoad ? src : undefined}
        muted
        loop
        playsInline
        preload="none"
        poster={poster}
        aria-label={ariaLabel}
        className={className}
      />
      {saveData !== null && (prefersReducedMotion === true || saveData) && !hasStarted ? (
        <button
          type="button"
          onClick={() => requestedPlay ? playVideo() : setRequestedPlay(true)}
          className={playButtonClassName}
        >
          {playLabel}
        </button>
      ) : null}
    </>
  );
}
