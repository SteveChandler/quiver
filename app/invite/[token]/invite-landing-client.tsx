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
import { getBrowserSessionId } from "@/lib/utils/browser-session-id";
import { getVisitorId } from "@/lib/utils/visitor-id";

type InviteLandingPlatform = "ios" | "android" | "desktop";

interface InviteLandingInviter {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface InviteLandingUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

interface InviteLandingClientProps {
  token: string;
  tokenHash: string;
  inviteUrl: string;
  startPath: string;
  inviter: InviteLandingInviter;
  utm: InviteLandingUtm;
}

type InviteEventType =
  | "invite_link_opened"
  | "invite_open_app_clicked"
  | "invite_app_store_clicked"
  | "invite_continue_web_clicked";

type InviteDestinationType =
  | "app_store"
  | "app_scheme"
  | "web_signup"
  | "android_waitlist";

type InviteMetadataOverride = Record<string, string | number | boolean | undefined>;

function detectPlatform(): InviteLandingPlatform {
  if (typeof navigator === "undefined") return "desktop";

  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "desktop";
}

function initialFor(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "Q";
}

export function InviteLandingClient({
  token,
  tokenHash,
  inviteUrl,
  startPath,
  inviter,
  utm,
}: InviteLandingClientProps): ReactElement {
  const [platform, setPlatform] = useState<InviteLandingPlatform>("desktop");
  const trackedOpen = useRef(false);
  const browserSessionId = useMemo(() => getBrowserSessionId(), []);
  const appSchemeUrl = `quiver://invite/${token}`;

  const commonMetadata = useMemo(
    () => ({
      token_hash: tokenHash,
      inviter_id: inviter.id,
      surface: "invite_landing",
      browser_session_id: browserSessionId,
      platform,
      ...utm,
    }),
    [browserSessionId, inviter.id, platform, tokenHash, utm],
  );

  const trackInviteEvent = useCallback(
    (
      eventType: InviteEventType,
      destinationType?: InviteDestinationType,
      metadataOverrides: InviteMetadataOverride = {},
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
        // Invite tracking must never block the CTA navigation.
      }
    },
    [commonMetadata],
  );

  useEffect(() => {
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);
    if (trackedOpen.current) return;
    trackedOpen.current = true;
    trackInviteEvent("invite_link_opened", undefined, {
      platform: detectedPlatform,
    });
  }, [trackInviteEvent]);

  const isAndroid = platform === "android";
  const leadCopy = isAndroid
    ? "Android access is waitlist-first for now. Join the Android waitlist or continue on web to use this invite."
    : platform === "desktop"
      ? "Open this invite on your iPhone to install Quiver, or scan the code below. If Quiver is already installed, open it from this page to accept the invite."
      : "Install Quiver from the App Store. If Quiver is already installed, open it from this page to accept the invite and connect automatically.";

  return (
    <main className="min-h-screen bg-[#252D6B] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="space-y-7">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/10 text-2xl font-bold text-[#FDB84B] ring-1 ring-white/15">
                {inviter.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small external profile avatar.
                  <img
                    src={inviter.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialFor(inviter.displayName)
                )}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-[#FDB84B]">
                  Quiver invite
                </p>
                <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
                  {inviter.displayName} invited you to their surf crew.
                </h1>
              </div>
            </div>

            <p className="max-w-2xl text-lg leading-8 text-white/78">
              {leadCopy}
            </p>

            <div className="flex flex-col gap-3 sm:max-w-md">
              {isAndroid ? (
                <AndroidWaitlistCta
                  source="invite_landing"
                  surface="invite_landing"
                  placement="primary_android"
                  onClickTrack={() =>
                    trackInviteEvent(
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
                    trackInviteEvent("invite_app_store_clicked", "app_store", {
                      attribution_scope: "app_store_click_only",
                      post_install_invite_consumption: false,
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
                    trackInviteEvent("invite_open_app_clicked", "app_scheme")
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
                  trackInviteEvent("invite_continue_web_clicked", "web_signup")
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
                value={inviteUrl}
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
              Scan with your iPhone camera to open this invite.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
