"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import { useOptionalAuth } from "@/context/auth-context";
import { useRoutePathname } from "@/hooks/use-route-pathname";
import type { CamInstallSheetCloseMethod } from "@/components/app-store/cam-install-sheet";
import { trackCamInstallSheetDismiss } from "@/lib/analytics/cam-install-sheet-tracking";
import {
  CAM_INSTALL_SHEET_PLAYBACK_SECONDS,
  getCamInstallSheetPlatform,
  isCamInstallSheetEnabled,
  isCamSheetAllowed,
  markCamSheetShownThisPageLoad,
  readCamSheetCap,
  subscribeCamPlayback,
  writeCamSheetCap,
  type CamInstallSheetPlatform,
} from "@/lib/app-store/cam-install-sheet";
import {
  closeInstallAskClaim,
  isInstallAskClaimed,
  openInstallAskClaim,
} from "@/lib/app-store/install-ask-claim";
import { isStandaloneDisplay } from "@/lib/app-store/install-bar";
import { buildSpotAskCopy } from "@/lib/app-store/spot-ask-copy";

// Visitors who never reach 45 s of playback never download the sheet (or the QR code).
const CamInstallSheet = dynamic(
  () => import("@/components/app-store/cam-install-sheet").then((m) => m.CamInstallSheet),
  { ssr: false },
);

interface CamInstallSheetMountProps {
  /** The page's beach display name. */
  spotName: string;
  /** Copy B height from `selectSpotAskTomorrowHeight`, or null for copy A. */
  tomorrowHeight: string | null;
  source: string;
  target: string;
}

/**
 * Server-renders nothing (CDN-shared HTML stays identical). After mount it
 * counts real cam playback reported by the cam players and opens the sheet at
 * 45 s, once per 7 days per browser, then claims the visit so no other install
 * ask shows.
 */
export function CamInstallSheetMount({
  spotName,
  tomorrowHeight,
  source,
  target,
}: CamInstallSheetMountProps): ReactElement | null {
  const pathname = useRoutePathname() ?? "";
  const auth = useOptionalAuth();
  const [platform, setPlatform] = useState<CamInstallSheetPlatform>("none");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isCamInstallSheetEnabled()) return;
    if (isStandaloneDisplay() || isInstallAskClaimed()) return;
    if (!isCamSheetAllowed(readCamSheetCap())) return;

    const detected = getCamInstallSheetPlatform(navigator.userAgent, navigator.maxTouchPoints);
    if (detected === "none") return;

    let playedSeconds = 0;
    const unsubscribe = subscribeCamPlayback((delta) => {
      playedSeconds += delta;
      if (playedSeconds < CAM_INSTALL_SHEET_PLAYBACK_SECONDS) return;

      unsubscribe();
      // Re-check: another tab may have shown it during playback.
      if (isInstallAskClaimed() || !isCamSheetAllowed(readCamSheetCap())) return;
      writeCamSheetCap();
      markCamSheetShownThisPageLoad();
      // Only the iPhone sheet claims the visit. The desktop card sits in a
      // corner; claiming would pull the in-page asks out of the page (layout
      // shift) and keep them hidden for the rest of the tab.
      if (detected === "iphone") openInstallAskClaim();
      setPlatform(detected);
      setOpen(true);
    });

    return unsubscribe;
  }, []);

  // A signed-in hero can show a personal value; B's number is the public one.
  const isAnonymous = Boolean(auth) && !auth?.isLoading && !auth?.user;
  const copy = useMemo(
    () =>
      buildSpotAskCopy({
        spotName,
        tomorrowHeight: isAnonymous ? tomorrowHeight : null,
      }),
    [isAnonymous, spotName, tomorrowHeight],
  );

  const handleClose = useCallback(
    (method: CamInstallSheetCloseMethod) => {
      if (platform !== "none" && method !== "cta") {
        trackCamInstallSheetDismiss({ pathname, variant: copy.variant, platform, method });
      }
      if (platform === "iphone") closeInstallAskClaim();
      setOpen(false);
    },
    [copy.variant, pathname, platform],
  );

  if (!open || platform === "none") return null;

  return (
    <CamInstallSheet
      platform={platform}
      copy={copy}
      source={source}
      target={target}
      pathname={pathname}
      onClose={handleClose}
    />
  );
}
