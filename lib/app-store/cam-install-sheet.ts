/*
 * Cam install sheet (feature key `cam_install_sheet`, approved 2026-11-27).
 *
 * After 45 s of real cam playback on a beach page, iPhone visitors get a
 * bottom sheet and desktop visitors a corner card with the desktop handoff QR.
 * Android gets nothing until Play production access is approved. Once per 7
 * days per browser. Read before/after, not split-tested:
 *   goal: >= 80 `cta_click` rows with `cta_family = ios_app` (all web surfaces)
 *   in the 30 days after live, from 38, with App Store Connect web-referrer
 *   first-time downloads not lower.
 * Off switch: NEXT_PUBLIC_CAM_INSTALL_SHEET=false.
 */

export const CAM_INSTALL_SHEET_PLACEMENT = "cam_sheet";
export const CAM_INSTALL_SHEET_PLAYBACK_SECONDS = 45;
const CAM_INSTALL_SHEET_CAP_DAYS = 7;
export const CAM_INSTALL_SHEET_STORAGE_KEY = "quiver_cam_install_sheet_shown_at";

/**
 * A `timeupdate` gap larger than this is a seek or a live-edge jump, not
 * playback (browsers fire `timeupdate` every 0.25 s or so while playing).
 */
const MAX_PLAYBACK_TICK_SECONDS = 1.5;

export function isCamInstallSheetEnabled(): boolean {
  // Literal access: Next inlines NEXT_PUBLIC_* only when read by name.
  return process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET !== "false";
}

export type CamInstallSheetPlatform = "iphone" | "desktop" | "none";

export function getCamInstallSheetPlatform(
  userAgent: string,
  maxTouchPoints = 0,
): CamInstallSheetPlatform {
  if (/android/i.test(userAgent)) return "none";
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  // There is no iPad layout. Older iPads say iPad; iPadOS 13+ Safari sends a
  // Mac user agent, so a touch "Mac" is an iPad.
  if (/iPad/.test(userAgent)) return "none";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "none";
  return "desktop";
}

/**
 * Seconds of real playback between two `timeupdate` reads of the same video.
 * Zero while paused or seeking, on the first read, and for jumps.
 */
export function playbackDeltaSeconds(
  previousTime: number | null,
  currentTime: number,
  isPlaying: boolean,
): number {
  if (!isPlaying || previousTime === null) return 0;
  if (!Number.isFinite(currentTime) || !Number.isFinite(previousTime)) return 0;
  const delta = currentTime - previousTime;
  if (delta <= 0 || delta > MAX_PLAYBACK_TICK_SECONDS) return 0;
  return delta;
}

type PlaybackListener = (deltaSeconds: number) => void;
const playbackListeners = new Set<PlaybackListener>();

/** Called by the cam players for each stretch of real playback. */
export function reportCamPlayback(deltaSeconds: number): void {
  if (!(deltaSeconds > 0)) return;
  playbackListeners.forEach((listener) => listener(deltaSeconds));
}

export function subscribeCamPlayback(listener: PlaybackListener): () => void {
  playbackListeners.add(listener);
  return () => {
    playbackListeners.delete(listener);
  };
}

type CamSheetCapRead =
  | { kind: "ok"; shownAt: Date | null }
  | { kind: "unavailable" };

export function readCamSheetCap(storage: () => Storage = () => window.localStorage): CamSheetCapRead {
  let raw: string | null;
  try {
    raw = storage().getItem(CAM_INSTALL_SHEET_STORAGE_KEY);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return { kind: "ok", shownAt: null };
  const shownAt = new Date(raw);
  return { kind: "ok", shownAt: Number.isNaN(shownAt.getTime()) ? null : shownAt };
}

export function writeCamSheetCap(
  now: Date = new Date(),
  storage: () => Storage = () => window.localStorage,
): boolean {
  try {
    storage().setItem(CAM_INSTALL_SHEET_STORAGE_KEY, now.toISOString());
    return true;
  } catch {
    return false;
  }
}

let shownThisPageLoad = false;

export function markCamSheetShownThisPageLoad(): void {
  shownThisPageLoad = true;
}

/** Test-only reset of the page-load flag. */
export function resetCamSheetPageLoadForTests(): void {
  shownThisPageLoad = false;
}

/**
 * Whether the sheet may show now. A shown date in the future or unreadable
 * counts as not shown. With storage unavailable the cap is once per page load.
 */
export function isCamSheetAllowed(cap: CamSheetCapRead, now: Date = new Date()): boolean {
  if (shownThisPageLoad) return false;
  if (cap.kind === "unavailable") return true;
  if (!cap.shownAt || cap.shownAt > now) return true;
  const capMs = CAM_INSTALL_SHEET_CAP_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - cap.shownAt.getTime() >= capMs;
}
