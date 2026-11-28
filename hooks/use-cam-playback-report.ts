"use client";

import { useEffect, type RefObject } from "react";

import {
  playbackDeltaSeconds,
  reportCamPlayback,
} from "@/lib/app-store/cam-install-sheet";

/**
 * Reports real playback of one cam `<video>` (not wall time): only stretches
 * where the element is playing and its clock moved forward a normal amount.
 * A cam that errors or never plays reports nothing.
 */
export function useCamPlaybackReport(
  videoRef: RefObject<HTMLVideoElement | null>,
  key?: unknown,
): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let previousTime: number | null = null;
    const isPlaying = (): boolean => !video.paused && !video.seeking && !video.ended;

    const onTimeUpdate = (): void => {
      const current = video.currentTime;
      reportCamPlayback(playbackDeltaSeconds(previousTime, current, isPlaying()));
      previousTime = isPlaying() ? current : null;
    };
    const onBreak = (): void => {
      previousTime = null;
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onBreak);
    video.addEventListener("seeking", onBreak);
    video.addEventListener("waiting", onBreak);
    video.addEventListener("error", onBreak);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onBreak);
      video.removeEventListener("seeking", onBreak);
      video.removeEventListener("waiting", onBreak);
      video.removeEventListener("error", onBreak);
    };
  }, [videoRef, key]);
}
