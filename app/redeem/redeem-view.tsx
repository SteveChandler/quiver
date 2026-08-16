"use client";

import {
  Component,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { track } from "@/lib/analytics";
import { trackAppHandoffQrRendered } from "@/lib/analytics/app-handoff-tracking";
import type { FirstTouchPlatform } from "@/lib/analytics/web-context";
import { getVisitorId } from "@/lib/utils/visitor-id";
import { ZineSurface } from "@/components/zine";
import type { RedeemPageState } from "@/lib/redeem/redeem-url";

export type RedeemViewState =
  | RedeemPageState
  | { kind: "loading" }
  | { kind: "error" };

type RedeemEventType = "page_view" | "cta_click";
type RedeemEventMetadata = Record<string, string | boolean | number>;

interface RedeemViewProps {
  platform: FirstTouchPlatform;
  state: RedeemViewState;
  onRetry?: () => void;
}

function recordRedeemEvent(
  eventType: RedeemEventType,
  metadata: RedeemEventMetadata,
): void {
  track(eventType, metadata);

  if (typeof window === "undefined") return;

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata,
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics must never block the redemption or install action.
  }
}

function stateHeading(state: RedeemViewState): string {
  if (state.kind === "available") return "Your Pro pass is ready.";
  if (state.kind === "missing") return "Find your purchase link.";
  if (state.kind === "malformed") return "Use a fresh purchase link.";
  if (state.kind === "loading") return "Loading your redemption page.";
  return "Let’s try that again.";
}

function stateIntro(state: RedeemViewState): string {
  if (state.kind === "available") {
    return "Purchase complete. Tap below on your phone to finish in Quiver. Safe to retry later.";
  }
  if (state.kind === "missing") {
    return "This page is for the handoff after a Quiver Pro purchase. Open the newest purchase email to return with your private redemption link, or contact Quiver support if you need help.";
  }
  if (state.kind === "malformed") {
    return "The redemption link we received cannot be read. Your newest purchase email has the current link to use on your phone.";
  }
  if (state.kind === "loading") {
    return "We are preparing the handoff from your purchase. Keep this page open for a moment.";
  }
  return "The redemption page could not finish loading. Use the newest link in your purchase email, then try again.";
}

function RedemptionQrFallback({ redeemUrl }: { redeemUrl: string }): ReactElement {
  return (
    <div
      aria-labelledby="redeem-qr-fallback-heading"
      className="border-[3px] border-[#11100D] bg-white p-5 shadow-[6px_7px_0_rgba(17,16,13,0.28)]"
      data-testid="redeem-qr-fallback"
      role="group"
    >
      <p className="label-black">QR unavailable</p>
      <h3
        id="redeem-qr-fallback-heading"
        className="zine-display mt-3 text-2xl uppercase leading-tight"
      >
        Open or copy your link
      </h3>
      <a
        href={redeemUrl}
        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] shadow-[2px_4px_0_rgba(17,16,13,0.18)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75]"
      >
        Open redemption link
      </a>
      <label
        htmlFor="redeem-copyable-link"
        className="mt-5 block font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#11100D]/75"
      >
        Copyable redemption link
      </label>
      <textarea
        id="redeem-copyable-link"
        aria-describedby="redeem-copyable-link-help"
        className="mt-2 min-h-24 w-full resize-none break-all border-2 border-[#11100D] bg-[#F4EBD8] p-3 font-mono text-xs leading-5 text-[#11100D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3A75]"
        onFocus={(event) => event.currentTarget.select()}
        readOnly
        rows={3}
        value={redeemUrl}
      />
      <p
        id="redeem-copyable-link-help"
        className="mt-2 text-sm leading-6 text-[#11100D]/70"
      >
        Select the text, then copy it into Quiver on your phone.
      </p>
    </div>
  );
}

interface RedemptionQrBoundaryProps {
  children: ReactNode;
  redeemUrl: string;
}

interface RedemptionQrBoundaryState {
  hasError: boolean;
}

class RedemptionQrBoundary extends Component<
  RedemptionQrBoundaryProps,
  RedemptionQrBoundaryState
> {
  state: RedemptionQrBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RedemptionQrBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <RedemptionQrFallback redeemUrl={this.props.redeemUrl} />;
    }

    return this.props.children;
  }
}

function RedemptionContent({
  onRetry,
  state,
}: {
  onRetry?: () => void;
  state: RedeemViewState;
}): ReactElement {
  if (state.kind === "loading") {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="mt-8 max-w-3xl border-y-2 border-[#11100D] py-8"
      >
        <p className="typewriter">One moment</p>
        <div className="mt-5 h-3 w-40 bg-[#11100D]/15" />
        <div className="mt-3 h-3 w-full max-w-xl bg-[#11100D]/10" />
      </section>
    );
  }

  if (state.kind === "available") {
    return (
      <section
        aria-labelledby="redeem-action-heading"
        className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center"
      >
        <div className="border-y-2 border-[#11100D] py-7 sm:py-9">
          <p className="label-black">Your next move</p>
          <h2
            id="redeem-action-heading"
            className="zine-display mt-5 max-w-xl text-3xl uppercase leading-[0.95] sm:text-5xl"
          >
            Open Quiver to finish
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#11100D]/80 sm:text-lg">
            Tap the button on your phone. It opens the Quiver app and carries
            this paid purchase into your account.
          </p>
          <a
            href={state.redeemUrl}
            data-redeem-url={state.redeemUrl}
            data-testid="redeem-primary-link"
            onClick={() =>
              recordRedeemEvent("cta_click", {
                cta_id: "redeem_purchase",
                page: "redeem",
                redemption_state: state.kind,
                surface: "redeem",
              })
            }
            className="mt-7 inline-flex min-h-14 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-7 py-4 font-mono text-sm font-bold uppercase tracking-[0.12em] text-[#11100D] shadow-[3px_5px_0_rgba(17,16,13,0.25)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75] active:translate-y-0"
          >
            Redeem Pro in Quiver
          </a>
          <p className="mt-5 max-w-lg font-mono text-xs uppercase leading-6 tracking-[0.08em] text-[#11100D]/70">
            Purchase complete · safe to retry · one redemption link
          </p>
        </div>

        <div className="hidden md:block">
          <RedemptionQrBoundary
            key={state.redeemUrl}
            redeemUrl={state.redeemUrl}
          >
            <div className="-rotate-1 border-[3px] border-[#11100D] bg-white p-3 shadow-[6px_7px_0_rgba(17,16,13,0.28)]">
              <QRCodeSVG
                aria-label="QR code for your Quiver Pro redemption link"
                data-redeem-qr="true"
                data-testid="redeem-qr"
                value={state.redeemUrl}
                size={244}
                level="H"
                marginSize={4}
                bgColor="#FFFFFF"
                fgColor="#11100D"
                imageSettings={{
                  src: "/quiver-app-icon-128.png",
                  width: 34,
                  height: 34,
                  excavate: true,
                }}
              />
            </div>
            <p className="mt-4 text-center font-mono text-xs font-bold uppercase leading-5 tracking-[0.1em] text-[#11100D]/75">
              Scan with your phone camera
            </p>
            <p className="mt-2 text-center text-sm leading-6 text-[#11100D]/70">
              This code carries your purchase link. Keep the phone nearby while
              Quiver opens.
            </p>
          </RedemptionQrBoundary>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="redeem-state-heading"
      className="mt-8 max-w-3xl border-y-2 border-[#11100D] py-8 sm:py-9"
    >
      <p className="label-black">
        {state.kind === "missing" ? "Start with your email" : "Link check"}
      </p>
      <h2
        id="redeem-state-heading"
        className="zine-display mt-5 max-w-2xl text-3xl uppercase leading-[0.95] sm:text-5xl"
      >
        {state.kind === "missing"
          ? "The handoff starts in your purchase email"
          : state.kind === "malformed"
            ? "That link is incomplete"
            : "We could not load the handoff"}
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#11100D]/80 sm:text-lg">
        {state.kind === "missing"
          ? "No redemption link was included in this visit, so there is nothing to open here. This does not mean your purchase failed. Use the newest Quiver purchase email or contact support."
          : state.kind === "malformed"
            ? "Please use the newest link from your purchase email. Do not reuse a link copied from an older message."
            : "Refresh this page or return through the newest link in your purchase email."}
      </p>
      {state.kind === "error" ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-12 items-center justify-center border-2 border-[#11100D] bg-[#F4EBD8] px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D] transition hover:bg-[#E5D4B3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75]"
        >
          Try loading again
        </button>
      ) : null}
    </section>
  );
}

export function RedeemView({
  platform,
  state,
  onRetry,
}: RedeemViewProps): ReactElement {
  const router = useRouter();
  const pageViewed = useRef(false);
  const qrTracked = useRef(false);
  const resolvedPlatform = platform;
  const retry = onRetry ?? (() => router.refresh());

  useEffect(() => {
    if (state.kind === "loading") return;
    if (pageViewed.current) return;
    pageViewed.current = true;
    recordRedeemEvent("page_view", {
      page: "redeem",
      redemption_state: state.kind,
      surface: "redeem",
    });
  }, [state.kind]);

  useEffect(() => {
    if (
      state.kind !== "available" ||
      resolvedPlatform !== "desktop" ||
      qrTracked.current
    ) {
      return;
    }

    qrTracked.current = true;
    trackAppHandoffQrRendered({
      source: "redeem",
      surface: "redeem",
      placement: "purchase_redemption_qr",
      platform: "desktop",
      destination_type: "revenuecat_redemption",
      qr_id: "revenuecat_redemption_qr",
      target: "redeem",
    });
  }, [resolvedPlatform, state.kind]);

  const isLoading = state.kind === "loading";

  return (
    <ZineSurface
      sectionLabel="Redeem"
      editionLabel="Quiver Pro purchase handoff"
      data-testid="redeem-zine-surface"
      className="px-3 py-5 sm:px-6 sm:py-12"
      stageClassName="mx-auto max-w-6xl"
      paperClassName="relative overflow-hidden"
    >
      <section
        aria-busy={isLoading}
        className="mx-auto max-w-5xl"
        data-redeem-state={state.kind}
        data-testid="redeem-view"
      >
        <header className="max-w-4xl">
          <h1 className="zine-display zine-h1 mt-5 max-w-4xl uppercase leading-[0.88] tracking-normal">
            {stateHeading(state)}
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#11100D]/80 sm:text-xl">
            {stateIntro(state)}
          </p>
        </header>

        <RedemptionContent onRetry={retry} state={state} />

        {!isLoading ? (
          <>
            <section
              aria-labelledby="install-fallback-heading"
              className="mt-11 grid gap-6 border-t-2 border-dashed border-[#11100D]/45 pt-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
            >
              <div>
                <p className="typewriter">Not installed yet?</p>
                <h2
                  id="install-fallback-heading"
                  className="zine-display mt-3 text-2xl uppercase leading-tight sm:text-3xl"
                >
                  Get Quiver on your phone
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[#11100D]/75">
                  The existing Quiver handoff chooses the right next step: App
                  Store on iPhone, Google Play beta on Android, or a phone QR
                  on desktop.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row md:flex-col">
                <Link
                  href="/app?source=redeem&surface=redeem&placement=install_fallback"
                  data-testid="redeem-install-fallback"
                  onClick={() =>
                    recordRedeemEvent("cta_click", {
                      cta_id: "install_fallback",
                      destination: "app_handoff",
                      page: "redeem",
                      redemption_state: state.kind,
                      surface: "redeem",
                    })
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-[14px_6px_16px_6px] bg-[#F78E42] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#11100D] shadow-[2px_4px_0_rgba(17,16,13,0.18)] motion-safe:transition-transform motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75]"
                >
                  Install or open Quiver
                </Link>
                <Link
                  href="/download"
                  className="inline-flex min-h-12 items-center justify-center border-2 border-[#11100D] px-5 py-3 text-center font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#0B3A75] underline decoration-[#F78E42] decoration-2 underline-offset-4 transition hover:bg-[#E5D4B3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75]"
                >
                  See install options
                </Link>
              </div>
            </section>

            <aside className="mt-10 border-t-2 border-[#11100D] pt-6">
              <p className="typewriter">Keep this fallback handy</p>
              <h2 className="zine-display mt-3 text-2xl uppercase leading-tight sm:text-3xl">
                Link expired or not opening?
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[#11100D]/80">
                Use the newest redemption link in your Quiver purchase email.
                If a link expires, RevenueCat sends a fresh one to that email.
                If the newest link still fails, contact{" "}
                <a
                  href="mailto:support@quiversurf.app"
                  className="font-semibold text-[#0B3A75] underline decoration-[#F78E42] decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0B3A75]"
                >
                  Quiver support
                </a>
                .
              </p>
            </aside>
          </>
        ) : null}

        {state.kind === "error" && onRetry ? (
          <p className="sr-only">A retry action is available above.</p>
        ) : null}
      </section>
    </ZineSurface>
  );
}
