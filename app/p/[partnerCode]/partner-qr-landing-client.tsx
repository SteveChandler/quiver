"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, ExternalLink, Smartphone } from "lucide-react";
import { AndroidWaitlistCta } from "@/components/pricing/android-waitlist-cta";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_URL,
} from "@/lib/constants/app-store";
import { trackAppHandoffQrRendered } from "@/lib/analytics/app-handoff-tracking";
import { getBrowserSessionId } from "@/lib/utils/browser-session-id";
import { getVisitorId } from "@/lib/utils/visitor-id";

type PartnerLandingPlatform = "ios" | "android" | "desktop";

interface PartnerLandingUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

interface PartnerQrLandingClientProps {
  partnerCode: string;
  partnerName: string | null;
  qrUrl: string;
  appSchemeUrl: string;
  startPath: string;
  utm: PartnerLandingUtm;
}

// Reuses the anonymous-allowed invite/app-handoff event family. No new literals.
type PartnerEventType =
  | "invite_link_opened"
  | "invite_open_app_clicked"
  | "invite_app_store_clicked"
  | "invite_continue_web_clicked";

type PartnerDestinationType =
  | "app_store"
  | "app_scheme"
  | "web_signup"
  | "android_waitlist";

type PartnerMetadataOverride = Record<
  string,
  string | number | boolean | undefined
>;

function detectPlatform(): PartnerLandingPlatform {
  if (typeof navigator === "undefined") return "desktop";

  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "desktop";
}

export function PartnerQrLandingClient({
  partnerCode,
  partnerName,
  qrUrl,
  appSchemeUrl,
  startPath,
  utm,
}: PartnerQrLandingClientProps): ReactElement {
  const [platform, setPlatform] = useState<PartnerLandingPlatform>("desktop");
  const trackedOpen = useRef(false);
  const trackedQr = useRef(false);
  const browserSessionId = useMemo(() => getBrowserSessionId(), []);

  const commonMetadata = useMemo(
    () => ({
      surface: "partner_landing",
      partner_code: partnerCode,
      browser_session_id: browserSessionId,
      platform,
      ...utm,
    }),
    [browserSessionId, partnerCode, platform, utm],
  );

  const trackPartnerEvent = useCallback(
    (
      eventType: PartnerEventType,
      destinationType?: PartnerDestinationType,
      metadataOverrides: PartnerMetadataOverride = {},
    ) => {
      if (typeof window === "undefined") return;

      try {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType,
            metadata: {
              ...commonMetadata,
              ...metadataOverrides,
              ...(destinationType ? { destination_type: destinationType } : {}),
            },
            sessionId: getVisitorId(),
            viewportWidth: window.innerWidth,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Tracking must never block the CTA navigation.
      }
    },
    [commonMetadata],
  );

  useEffect(() => {
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);
    if (trackedOpen.current) return;
    trackedOpen.current = true;
    trackPartnerEvent("invite_link_opened", undefined, {
      platform: detectedPlatform,
    });
    if (!trackedQr.current) {
      trackedQr.current = true;
      trackAppHandoffQrRendered({
        source: "partner_landing",
        surface: "partner_landing",
        placement: "desktop_partner_qr",
        platform: detectedPlatform,
        destination_type: "partner_deep_link",
        destination_url: qrUrl,
        qr_id: "partner_desktop_qr",
        target: "partner",
        partner_code: partnerCode,
        ...utm,
      });
    }
    // trackPartnerEvent identity changes with platform; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerCode, qrUrl]);

  const isAndroid = platform === "android";
  const partnerLabel = partnerName?.trim() || "A Quiver partner";
  const leadCopy = isAndroid
    ? "Android access is waitlist-first for now. Join the Android waitlist or continue on web to start with Quiver."
    : platform === "desktop"
      ? "Scan the code with your phone camera, or open this page on your iPhone to install Quiver. Already have the app? Open it from here."
      : "Install Quiver from the App Store to check the surf and log your sessions. If Quiver is already installed, open it from this page.";

  return (
    <main className="min-h-screen bg-[#252D6B] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="space-y-7">
            <div>
              <p className="text-sm font-semibold uppercase text-[#FDB84B]">
                Quiver
              </p>
              <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
                {partnerLabel} wants you on Quiver.
              </h1>
            </div>

            <p className="max-w-2xl text-lg leading-8 text-white/78">
              {leadCopy}
            </p>

            <div className="flex flex-col gap-3 sm:max-w-md">
              {isAndroid ? (
                <AndroidWaitlistCta
                  source="partner_landing"
                  surface="partner_landing"
                  placement="primary_android"
                  onClickTrack={() =>
                    trackPartnerEvent(
                      "invite_app_store_clicked",
                      "android_waitlist",
                    )
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#F78E42] px-5 py-3 text-center font-semibold text-[#252D6B] transition hover:bg-[#FFAA63] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Join Android waitlist
                </AndroidWaitlistCta>
              ) : (
                <a
                  href={IOS_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackPartnerEvent("invite_app_store_clicked", "app_store", {
                      attribution_scope: "app_store_click_only",
                    })
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#F78E42] px-5 py-3 text-center font-semibold text-[#252D6B] transition hover:bg-[#FFAA63]"
                >
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                  {IOS_APP_STORE_CTA}
                </a>
              )}

              {!isAndroid ? (
                <a
                  href={appSchemeUrl}
                  onClick={() =>
                    trackPartnerEvent("invite_open_app_clicked", "app_scheme")
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/16 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
                >
                  Already have the app? Open Quiver
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}

              <a
                href={startPath}
                onClick={() =>
                  trackPartnerEvent("invite_continue_web_clicked", "web_signup")
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 py-3 text-center font-semibold text-white/82 transition hover:bg-white/8"
              >
                Continue on web
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="hidden rounded-lg border border-white/12 bg-white/8 p-5 shadow-2xl shadow-black/25 lg:block">
            <div className="rounded-md bg-white p-4">
              <QRCodeSVG
                value={qrUrl}
                data-smart-url={qrUrl}
                size={248}
                level="H"
                marginSize={4}
                bgColor="#FFFFFF"
                fgColor="#252D6B"
                imageSettings={{
                  src: "/quiver-app-icon-128.png",
                  width: 34,
                  height: 34,
                  excavate: true,
                }}
              />
            </div>
            <p className="mt-4 text-center text-sm font-medium text-white/72">
              Scan with your phone camera to get Quiver.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
