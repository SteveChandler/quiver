"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { buildBeachWatchAppLink, buildBeachWatchRule, type BeachWatchWindow } from "@/lib/alerts/beach-watch";
import { trackAppHandoffLinkOpened, trackAppHandoffView } from "@/lib/analytics/app-handoff-tracking";
import { NATIVE_SELECTED_WINDOW_WATCH } from "@/lib/constants/app-capabilities";
import { captureClientPostHogEventAfterConsent } from "@/lib/posthog-client";
import type { PublicSurfCall } from "@/lib/utils/public-surf-call";

interface BeachActionsProps {
  beach: { id: string; slug: string; name: string };
  watchWindow: BeachWatchWindow | null;
  score: number | null;
  shareUrl: string;
  hasCamStill: boolean;
  waterTempF: number | null;
  call: PublicSurfCall;
}

type WatchState = "idle" | "saving" | "watching";

const BUTTON = "flex min-h-14 items-center gap-3 rounded-2xl border-2 border-[#11100D] px-4 py-3 text-left text-[#11100D]";

export function BeachActions({ beach, watchWindow, score, shareUrl, hasCamStill, waterTempF, call }: BeachActionsProps) {
  const { user } = useAuth();
  const [watchState, setWatchState] = useState<WatchState>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetNote, setSheetNote] = useState<string | null>(null);

  const watchButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sheetOpen) panelRef.current?.focus();
  }, [sheetOpen]);

  function closeAppSheet(): void {
    setSheetOpen(false);
    watchButtonRef.current?.focus();
  }

  const appLink = watchWindow ? buildBeachWatchAppLink(beach.slug, watchWindow.forecastAt) : null;
  const handoff = { source: `beach-detail-${beach.slug}`, surface: "beach_detail", placement: "beach_watch" } as const;
  const canWatchHere = Boolean(user) || NATIVE_SELECTED_WINDOW_WATCH;

  function openAppSheet(note: string | null) {
    if (!appLink) return;
    setSheetNote(note);
    setSheetOpen(true);
    trackAppHandoffView({ ...handoff, destination_url: appLink });
  }

  async function handleWatch() {
    if (!watchWindow || !appLink || watchState !== "idle") return;
    if (user) {
      setWatchState("saving");
      try {
        const res = await fetch("/api/alerts/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildBeachWatchRule({ beachId: beach.id, beachName: beach.name, window: watchWindow, score })),
        });
        if (res.ok) {
          setWatchState("watching");
          toast.success(`Watching ${beach.name} ${watchWindow.label}`);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as { error?: unknown };
        setWatchState("idle");
        openAppSheet(typeof json.error === "string" ? json.error : "Couldn't save the watch here.");
      } catch (error) {
        console.error("[BeachActions] watch failed", error instanceof Error ? error.message : error);
        setWatchState("idle");
        openAppSheet("Couldn't reach Quiver to save the watch.");
      }
      return;
    }
    openAppSheet(null);
  }

  async function handleShare() {
    captureClientPostHogEventAfterConsent("beach_share_opened", { beach_id: beach.id, beach_slug: beach.slug });
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${beach.name} today`, url: shareUrl });
      } catch (error) {
        // Closing the share sheet rejects with AbortError; anything else is a real failure.
        if (!(error instanceof DOMException && error.name === "AbortError")) toast.error("Couldn't open sharing");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  const watchText =
    watchState === "watching" ? "Watching" : canWatchHere && watchWindow ? `Watch ${watchWindow.label}` : "Open in the app";
  const shareDetails = [hasCamStill ? "cam still" : null, waterTempF != null ? "water temp" : null, call.kind === "call" ? "surf call" : null].filter((detail): detail is string => detail !== null);
  const shareList = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" })
    .format(shareDetails.map((detail, i) => i === 0 ? detail : `the ${detail}`));

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-[1.25fr_1fr]">
      {watchWindow ? (
        <button
          type="button"
          data-testid="beach-watch-button"
          ref={watchButtonRef}
          aria-expanded={sheetOpen}
          aria-controls="beach-app-panel"
          onClick={handleWatch}
          disabled={watchState === "saving"}
          className={`${BUTTON} bg-[#F78E42] shadow-[4px_4px_0_#000]`}
        >
          <Eye aria-hidden className="h-5 w-5 shrink-0" />
          <span>
            <span className="block text-base font-bold">{watchText}</span>
            <span className="block text-sm text-[#3a1f08]">{canWatchHere ? "For surfers: a heads-up on your phone if it changes." : `Open ${beach.name} in the Quiver app.`}</span>
          </span>
        </button>
      ) : null}
      <button type="button" data-testid="beach-share-button" onClick={handleShare} className={`${BUTTON} bg-[#F4EBD8] ${watchWindow ? "" : "md:col-span-2"}`}>
        <Share2 aria-hidden className="h-5 w-5 shrink-0" />
        <span>
          <span className="block text-base font-bold">Share {beach.name} today</span>
          <span className="block text-sm text-[#3d3326]">{shareDetails.length ? `The ${shareList}.` : "The beach page."}</span>
        </span>
      </button>
      <p role="status" aria-live="polite" className="sr-only">{sheetNote}</p>
      {sheetOpen && appLink && watchWindow ? (
        <div
          id="beach-app-panel"
          ref={panelRef}
          role="region"
          aria-label="Open in the Quiver app"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeAppSheet();
            }
          }} className="flex items-center gap-4 rounded-2xl border border-dashed border-[#F5EEDC]/35 bg-[#F5EEDC]/5 p-4 md:col-span-2">
          <div className="hidden rounded-lg bg-white p-2 md:block">
            <QRCodeSVG value={appLink} size={96} />
          </div>
          <div className="text-sm text-[#F5EEDC]">
            {sheetNote ? <p className="mb-1 font-bold">{sheetNote}</p> : null}
            <a
              href={appLink}
              className="inline-flex min-h-11 items-center font-bold underline"
              onClick={() => trackAppHandoffLinkOpened({ ...handoff, destination_url: appLink })}
            >
              {NATIVE_SELECTED_WINDOW_WATCH
                ? `Watch ${beach.name} ${watchWindow.label} in the Quiver app`
                : `Open ${beach.name} in the Quiver app`}
            </a>
            <button type="button" onClick={closeAppSheet} className="ml-4 min-h-11 underline">Close</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
