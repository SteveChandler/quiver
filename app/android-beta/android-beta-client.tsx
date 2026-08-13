"use client";

import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_PLAY_URL,
  ANDROID_PLAY_STORE_LISTING_URL,
} from "@/lib/constants/app-store";
import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import { QuiverSticker, ZineSurface } from "@/components/zine";
import { getVisitorId } from "@/lib/utils/visitor-id";
import { cn } from "@/lib/utils";
import {
  normalizeInstallAttribution,
  type InstallAttribution,
} from "@/lib/install-attribution";
import { trackAndroidInstallCtaClick } from "@/lib/analytics/android-waitlist-tracking";

const ANDROID_BETA_SMART_QR_URL = buildSmartQrHandoffUrl({
  source: "android_beta_page",
  surface: "android_beta",
  placement: "instructions_qr",
  qr_id: "android_beta_instructions",
  target: "android_beta",
  utm_medium: "android_beta",
});

const STEPS = [
  {
    title: "Join the tester group",
    body: "Join the Quiver Android testers Google Group with the Google account you use on your phone.",
  },
  {
    title: "Opt in on Google Play",
    body: "Open the closed-test link and tap “Become a tester” to unlock the Quiver install on Google Play.",
  },
  {
    title: "Install Quiver",
    body: "Once you're opted in, install Quiver straight from Google Play on that same account.",
  },
  {
    title: "Shape Android quality",
    body: `Use Quiver on your real surf routine and tell us where the Android experience needs work. Email ${ANDROID_BETA_CONTACT_EMAIL} if you hit any bugs.`,
  },
] as const;

type CaptureStatus = "idle" | "saving" | "saved" | "error";

const BETA_CAPTURE_SOURCE = "android_beta_page";
const BETA_CAPTURE_SURFACE = "android_beta";
const BETA_CAPTURE_PLACEMENT = "hero_email_capture";

function trackAndroidBetaOutboundClick(destinationType: string): void {
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "cta_click",
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
        metadata: {
          cta_family: "android_waitlist",
          platform: "android",
          source: BETA_CAPTURE_SOURCE,
          surface: BETA_CAPTURE_SURFACE,
          placement: destinationType,
          destination_type: destinationType,
          destination_status: "outbound",
        },
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never block the handoff.
  }
}

interface AndroidBetaClientProps {
  installAttributionIssuanceEnabled: boolean;
}

export function AndroidBetaClient({
  installAttributionIssuanceEnabled,
}: AndroidBetaClientProps) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [capturedEmail, setCapturedEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const installAttribution = useMemo<InstallAttribution>(
    () =>
      normalizeInstallAttribution(
        Object.fromEntries(searchParams.entries()),
      ),
    [searchParams],
  );
  const [attributedStoreUrl, setAttributedStoreUrl] = useState<string | null>(
    installAttributionIssuanceEnabled
      ? null
      : ANDROID_PLAY_STORE_LISTING_URL,
  );
  const [installLinkFailed, setInstallLinkFailed] = useState(false);
  const [installLinkLoading, setInstallLinkLoading] = useState(false);
  const hasCapturedEmail = status === "saved" && Boolean(capturedEmail);

  const issueInstallLink = useCallback(async (): Promise<void> => {
    setInstallLinkFailed(false);
    setInstallLinkLoading(true);
    try {
      const response = await fetch("/api/install-attribution/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(installAttribution),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        storeUrl?: string;
      } | null;
      if (!response.ok || !result?.success || !result.storeUrl) {
        setInstallLinkFailed(true);
        return;
      }
      setAttributedStoreUrl(result.storeUrl);
    } catch {
      setInstallLinkFailed(true);
    } finally {
      setInstallLinkLoading(false);
    }
  }, [installAttribution]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (status === "saving") return;

    setStatus("saving");
    setInlineError(null);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch("/api/android-beta/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          sessionId: getVisitorId(),
          source: BETA_CAPTURE_SOURCE,
          surface: BETA_CAPTURE_SURFACE,
          placement: BETA_CAPTURE_PLACEMENT,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !result?.success) {
        setInlineError(
          result?.error === "invalid_email"
            ? "Enter a valid email address."
            : "Could not save your email. Try again.",
        );
        setStatus("error");
        return;
      }

      setCapturedEmail(normalizedEmail);
      setStatus("saved");
    } catch {
      setInlineError("Could not save your email. Try again.");
      setStatus("error");
    }
  }

  function handleEditEmail(): void {
    setStatus("idle");
    setInlineError(null);
  }

  const handoffButtonClass =
    "inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] px-5 py-2 font-semibold shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5";

  return (
    <ZineSurface
      sectionLabel="Android beta"
      editionLabel="Closed test handoff"
      data-testid="android-beta-zine-surface"
    >
      <main>
        <header className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="relative">
            <QuiverSticker
              sticker="orangeTape"
              className="absolute -top-8 right-6 hidden w-36 rotate-6 opacity-85 sm:block"
            />
            <p className="label-black mb-5">Android closed beta</p>
            <h1 className="zine-h1 font-black uppercase leading-[0.88] tracking-normal text-[#11100D]">
              Join the Quiver Android beta
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#11100D]/75 sm:text-xl">
              Get personalized surf decisions and best-window guidance across
              279+ beaches, then keep saved spots, alerts, and session logging
              with you in the native Android app. Access is available now after
              Google&apos;s closed-test steps. Email is optional if you want a
              copy of the instructions.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-[0.14em] text-[#11100D]/65">
              <span>Google Group invite</span>
              <span aria-hidden>/</span>
              <span>Play closed test</span>
              <span aria-hidden>/</span>
              <span>Same Google account</span>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={ANDROID_BETA_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAndroidBetaOutboundClick("google_group")}
                className={cn(
                  handoffButtonClass,
                  "bg-[#F78E42] text-[#11100D]",
                )}
              >
                1 · Join the tester group
              </a>
              {ANDROID_BETA_PLAY_URL ? (
                <a
                  href={ANDROID_BETA_PLAY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackAndroidBetaOutboundClick("google_play")}
                  className={cn(
                    handoffButtonClass,
                    "bg-[#11100D] text-[#F4EBD8]",
                  )}
                >
                  2 · Opt in on Google Play
                </a>
              ) : null}
              {attributedStoreUrl ? (
                <a
                  href={attributedStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackAndroidInstallCtaClick(installAttribution)
                  }
                  className={cn(
                    handoffButtonClass,
                    "bg-[#7BDCB5] text-[#11100D]",
                  )}
                >
                  3 · Install from Google Play
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => void issueInstallLink()}
                  disabled={installLinkLoading}
                  className={cn(
                    handoffButtonClass,
                    "bg-[#7BDCB5] text-[#11100D] disabled:cursor-wait disabled:opacity-70",
                  ) + " focus-ring"}
                >
                  {installLinkLoading
                    ? "3 · Preparing Play install link..."
                    : installLinkFailed
                      ? "3 · Retry Play install link"
                      : "3 · Prepare Play install link"}
                </button>
              )}
              <a
                href={ANDROID_BETA_CONTACT_MAILTO}
                onClick={() => trackAndroidBetaOutboundClick("email_contact")}
                className="inline-flex min-h-11 items-center rounded-full border-2 border-[#11100D] bg-[#FBF6E8] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)] transition-transform hover:-translate-y-0.5"
              >
                Email {ANDROID_BETA_CONTACT_EMAIL}
              </a>
            </div>

            {hasCapturedEmail ? (
              <div className="mt-7 rounded-[14px_6px_16px_6px] border-2 border-[#11100D] bg-[#7BDCB5] px-4 py-3 text-[#11100D] shadow-[2px_3px_0_rgba(17,16,13,0.25)]">
                <p
                  className="break-words font-mono text-sm font-bold tracking-[0.08em]"
                  role="status"
                >
                  Saved {capturedEmail}. We&apos;ll send the beta instructions.
                </p>
                <button
                  type="button"
                  onClick={handleEditEmail}
                  className="mt-2 font-mono text-xs font-bold uppercase tracking-[0.12em] underline decoration-2 underline-offset-4 focus-ring"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="mt-8 grid max-w-xl gap-3 rounded-[18px_8px_20px_10px] border-2 border-[#11100D] bg-[#FBF6E8] p-4 shadow-[3px_4px_0_rgba(17,16,13,0.24)] sm:grid-cols-[minmax(0,1fr)_auto]"
                noValidate
              >
                <label
                  htmlFor="android-beta-email"
                  className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#11100D]/65 sm:col-span-2"
                >
                  Google account email — optional
                </label>
                <input
                  id="android-beta-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (inlineError) setInlineError(null);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="you@email.com"
                  className="min-h-12 min-w-0 rounded-md border-2 border-[#11100D] bg-white px-3 font-sans text-base font-semibold text-[#11100D] placeholder:text-[#11100D]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF6E8]"
                  aria-describedby={
                    inlineError ? "android-beta-email-error" : undefined
                  }
                />
                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-[#11100D] bg-[#F78E42] px-5 py-2 font-semibold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.35)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0 focus-ring"
                >
                  {status === "saving"
                    ? "Saving..."
                    : "Email me beta instructions"}
                </button>
                <p className="text-sm leading-relaxed text-[#11100D]/70 sm:col-span-2">
                  Optional: use the Google account email you&apos;ll use for the
                  tester group and Google Play, and we&apos;ll send a copy of
                  the instructions. Access does not depend on sharing it.
                </p>
                {inlineError ? (
                  <p
                    id="android-beta-email-error"
                    className="font-sans text-sm font-semibold text-[#B5452C] sm:col-span-2"
                    role="alert"
                  >
                    {inlineError}
                  </p>
                ) : null}
              </form>
            )}
          </div>

          <aside className="relative">
            <QuiverSticker
              sticker="creamTape"
              className="absolute -top-6 left-8 z-10 w-28 -rotate-6 opacity-90"
            />
            <div className="torn torn-tb rot-2 border-2 border-[#11100D] bg-[#FBF6E8]">
              <div className="mx-auto w-fit border-2 border-[#11100D] bg-white p-4 shadow-[3px_3px_0_rgba(17,16,13,0.25)]">
                <QRCodeSVG
                  data-testid="android-beta-qr"
                  data-smart-url={ANDROID_BETA_SMART_QR_URL}
                  value={ANDROID_BETA_SMART_QR_URL}
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
              <div className="mt-5 space-y-2 text-center">
                <p className="typewriter mb-1">Scan to start</p>
                <h2 className="font-display text-lg font-black uppercase leading-tight text-[#11100D]">
                  Scan for the beta instructions
                </h2>
                <p className="text-sm leading-relaxed text-[#11100D]/70">
                  This QR code uses the Quiver smart handoff: Android routes to
                  the beta access path, iPhone routes to the App Store, and
                  desktop gets the phone handoff.
                </p>
              </div>
            </div>
          </aside>
        </header>

        <section className="mt-14" aria-labelledby="android-beta-steps-heading">
          <div className="mb-5 flex items-end justify-between gap-4 border-b-2 border-dashed border-[#11100D]/35 pb-4">
            <div>
              <p className="typewriter mb-2">How to get in</p>
              <h2
                id="android-beta-steps-heading"
                className="font-display text-2xl font-black uppercase leading-tight text-[#11100D] sm:text-3xl"
              >
                Four steps into the closed test
              </h2>
            </div>
            <QuiverSticker
              sticker="orangeMap"
              className="hidden w-14 rotate-6 drop-shadow-sm sm:block"
            />
          </div>

          <ol className="grid gap-5 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="notebook grid gap-3 sm:grid-cols-[3rem_1fr]"
              >
                <span className="font-mono text-sm font-bold text-[#B56A2B]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-xl font-black uppercase leading-tight text-[#11100D]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#11100D]/70">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </ZineSurface>
  );
}
