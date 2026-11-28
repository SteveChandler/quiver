"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { createClientAppHandoffLink } from "@/lib/analytics/app-handoff-link";
import { trackAppHandoffQrRendered } from "@/lib/analytics/app-handoff-tracking";
import {
  CAM_INSTALL_SHEET_SURFACE,
  trackCamInstallSheetView,
} from "@/lib/analytics/cam-install-sheet-tracking";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";
import { CAM_INSTALL_SHEET_PLACEMENT } from "@/lib/app-store/cam-install-sheet";
import type { SpotAskCopy } from "@/lib/app-store/spot-ask-copy";
import {
  buildAppHandoffUrl,
  buildSmartQrHandoffUrl,
} from "@/lib/constants/app-handoff";
import { getClientPostHogDistinctId } from "@/lib/posthog-client";
import { cn } from "@/lib/utils";

export type CamInstallSheetCloseMethod = "not_now" | "escape" | "cta";

interface CamInstallSheetProps {
  platform: "iphone" | "desktop";
  copy: SpotAskCopy;
  source: string;
  target: string;
  pathname: string;
  onClose: (method: CamInstallSheetCloseMethod) => void;
}

const QR_ID = `${CAM_INSTALL_SHEET_SURFACE}_${CAM_INSTALL_SHEET_PLACEMENT}_qr`;
const HEADING_ID = "cam-install-sheet-heading";

/** Escape belongs to fullscreen video and open modal dialogs first. */
function escapeBelongsElsewhere(): boolean {
  if (document.fullscreenElement) return true;
  return document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]') !== null;
}

/**
 * The cam install ask. Not a modal: the cam keeps playing above it, the page
 * keeps scrolling, and focus never moves. iPhone gets a bottom sheet over the
 * lower third; desktop gets a corner card with the desktop handoff QR code.
 * Mounted lazily by `CamInstallSheetMount`, which owns eligibility.
 */
export function CamInstallSheet({
  platform,
  copy,
  source,
  target,
  pathname,
  onClose,
}: CamInstallSheetProps): ReactElement {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  const [qrHandoffId, setQrHandoffId] = useState<string | null>(null);

  useEffect(() => {
    trackCamInstallSheetView({ pathname, variant: copy.variant, platform });
    // One view per sheet, whatever re-renders follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (escapeBelongsElsewhere()) return;
      onClose("escape");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // WCAG 2.4.11: keep focused page elements from sitting under the sheet.
  useEffect(() => {
    if (platform !== "iphone") return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${rootRef.current?.offsetHeight ?? 200}px`;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [platform]);

  useEffect(() => {
    if (platform === "desktop") setQrHandoffId(crypto.randomUUID());
  }, [platform]);

  const qrValue = useMemo(
    () =>
      qrHandoffId
        ? buildSmartQrHandoffUrl({
            source,
            surface: CAM_INSTALL_SHEET_SURFACE,
            placement: CAM_INSTALL_SHEET_PLACEMENT,
            handoff_id: qrHandoffId,
            qr_id: QR_ID,
            target,
            utm_medium: "desktop_handoff",
            web_distinct_id: getClientPostHogDistinctId(),
          })
        : null,
    [qrHandoffId, source, target],
  );

  useEffect(() => {
    if (!qrHandoffId || !qrValue) return;
    trackAppHandoffQrRendered({
      source,
      surface: CAM_INSTALL_SHEET_SURFACE,
      placement: CAM_INSTALL_SHEET_PLACEMENT,
      handoff_id: qrHandoffId,
      variant: copy.variant,
      platform: "desktop",
      destination_type: "app_handoff",
      qr_id: QR_ID,
      target,
    });
    // Once per rendered code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrHandoffId]);

  const href = useMemo(
    () =>
      buildAppHandoffUrl({
        source,
        surface: CAM_INSTALL_SHEET_SURFACE,
        placement: CAM_INSTALL_SHEET_PLACEMENT,
        target,
      }),
    [source, target],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const handoff = createClientAppHandoffLink({
        source,
        surface: CAM_INSTALL_SHEET_SURFACE,
        placement: CAM_INSTALL_SHEET_PLACEMENT,
        target,
      });
      event.currentTarget.href = handoff.url;
      trackIosAppCtaClick({
        source,
        surface: CAM_INSTALL_SHEET_SURFACE,
        placement: CAM_INSTALL_SHEET_PLACEMENT,
        cta_text: copy.cta,
        destination_url: handoff.url,
        handoff_id: handoff.handoffId,
        link_kind: "handoff",
        pathname,
        variant: copy.variant,
      });
      onClose("cta");
    },
    [copy.cta, copy.variant, onClose, pathname, source, target],
  );

  const motion = reducedMotion
    ? cn("transition-opacity duration-200", entered ? "opacity-100" : "opacity-0")
    : cn(
        "transition-[opacity,transform] duration-300 ease-out",
        entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      );

  const notNow = (
    <button
      type="button"
      onClick={() => onClose("not_now")}
      className="min-h-11 w-full rounded-full !bg-transparent text-sm text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      Not now
    </button>
  );

  const heading = (
    <div className="flex items-center gap-3">
      <Image
        src="/quiver-app-icon-128.png"
        alt=""
        width={36}
        height={36}
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-[8px]"
      />
      <h2 id={HEADING_ID} className="font-heading text-base font-semibold leading-5">
        {copy.headline}
      </h2>
    </div>
  );

  if (platform === "desktop") {
    return (
      <aside
        ref={rootRef}
        aria-labelledby={HEADING_ID}
        data-testid="cam-install-sheet"
        data-platform="desktop"
        data-variant={copy.variant}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-3 rounded-xl border border-white/10 bg-[#252D6B] p-4 text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)]",
          motion,
        )}
      >
        {heading}
        <p className="text-sm leading-5 text-white/75">{copy.body}</p>
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-lg bg-[#F4EBD8] p-1.5">
            {qrValue ? (
              <QRCodeSVG
                aria-label="Scan to open Quiver on your phone"
                data-testid="cam-install-sheet-qr"
                data-smart-url={qrValue}
                value={qrValue}
                size={104}
                level="H"
                marginSize={2}
                bgColor="#F4EBD8"
                fgColor="#11100D"
                imageSettings={{
                  src: "/quiver-app-icon-128.png",
                  width: 20,
                  height: 20,
                  excavate: true,
                }}
              />
            ) : (
              <div aria-hidden="true" className="size-[104px]" />
            )}
          </div>
          <p className="text-xs leading-4 text-white/75">
            Scan with your phone to open Quiver.
          </p>
        </div>
        {notNow}
      </aside>
    );
  }

  return (
    <aside
      ref={rootRef}
      aria-labelledby={HEADING_ID}
      data-testid="cam-install-sheet"
      data-platform="iphone"
      data-variant={copy.variant}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 max-h-[50vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#252D6B] text-white shadow-[0_-4px_20px_rgba(0,0,0,0.3)]",
        "pb-[env(safe-area-inset-bottom)]",
        motion,
      )}
    >
      <div className="flex flex-col gap-3 px-4 pb-3 pt-2">
        <span aria-hidden="true" className="h-1 w-8 self-center rounded-full bg-white/35" />
        {heading}
        <p className="text-sm leading-5 text-white/75">{copy.body}</p>
        <a
          href={href}
          onClick={handleClick}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#F78E42] px-4 text-sm font-semibold text-[#11100D] transition hover:bg-[#FDB84B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#252D6B]"
        >
          {copy.cta}
        </a>
        {notNow}
      </div>
    </aside>
  );
}
