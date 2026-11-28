"use client";

import dynamic from "next/dynamic";
import { useRoutePathname } from "@/hooks/use-route-pathname";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";

import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { useInstallAskClaim } from "@/hooks/use-install-ask-claim";
import { usePersistedDismissal } from "@/hooks/use-persisted-dismissal";
import {
  getInstallBarOwnedSurface,
  INSTALL_BAR_DISMISSAL_DAYS,
  INSTALL_BAR_DISMISSAL_KEY,
  isStandaloneDisplay,
} from "@/lib/app-store/install-bar";

// Visitors the bar does not own never download its code.
const InstallBar = dynamic(
  () => import("@/components/app-store/install-bar").then((m) => m.InstallBar),
  { ssr: false },
);

interface StickyInstallAskProps {
  /** The page's existing fixed-bottom signup bar, if it has one. */
  stickySignup?: ComponentProps<typeof StickySignupBar>;
  bar: {
    /** Spot name on spot pages, place name on place pages. */
    placeName: string;
    /** Copy B height on spot pages (see `selectSpotAskTomorrowHeight`). */
    tomorrowHeight?: string | null;
    source: string;
  };
}

/**
 * A page's one fixed-bottom ask.
 *
 * The page HTML is shared at the CDN, so the server and the first client render
 * are exactly the page's signup bar (or nothing) and every decision happens
 * after mount. An iPhone visitor on a bar surface gets the install bar in that
 * slot instead, never both; once they dismiss it the slot falls back to the
 * signup bar, so the two asks are sequential, never simultaneous.
 *
 * Once the cam install sheet claims the visit, the bar never shows again in it;
 * the slot stays empty while the sheet is open, then falls back to the signup bar.
 */
export function StickyInstallAsk({
  stickySignup,
  bar,
}: StickyInstallAskProps): ReactElement | null {
  const pathname = useRoutePathname() ?? "";
  const claim = useInstallAskClaim();
  const { isDismissed, handleDismiss } = usePersistedDismissal(
    INSTALL_BAR_DISMISSAL_KEY,
    { durationDays: INSTALL_BAR_DISMISSAL_DAYS, storage: "local" },
  );

  // Set from an effect declared after the dismissal hook's, so both updates land
  // in one render and the dismissal flag is real by the time `ready` is true.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const surface = useMemo(
    () =>
      ready
        ? getInstallBarOwnedSurface({
            userAgent: navigator.userAgent,
            pathname,
            isStandalone: isStandaloneDisplay(),
          })
        : null,
    [pathname, ready],
  );

  if (claim === "open") return null;

  if (surface && !isDismissed && claim === "none") {
    return (
      <InstallBar
        surface={surface}
        placeName={bar.placeName}
        tomorrowHeight={bar.tomorrowHeight ?? null}
        source={bar.source}
        pathname={pathname}
        onDismiss={handleDismiss}
      />
    );
  }

  return stickySignup ? <StickySignupBar {...stickySignup} /> : null;
}
