"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  trackAppHandoffEmailFailed,
  trackAppHandoffEmailSent,
  trackAppHandoffEmailSubmit,
  trackAppHandoffQrRendered,
} from "@/lib/analytics/app-handoff-tracking";
import { buildSmartQrHandoffUrl } from "@/lib/constants/app-handoff";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import { cn } from "@/lib/utils";

interface SendToPhoneCtaProps {
  source: string;
  surface: string;
  placement: string;
  variant?: string;
  cohort?: string;
  qrId?: string;
  target?: string;
  handoffId?: string;
  className?: string;
  showEmailForm?: boolean;
}

type SendState = "idle" | "sending" | "sent" | "error" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SendToPhoneCta({
  source,
  surface,
  placement,
  variant,
  cohort,
  qrId,
  target,
  handoffId: providedHandoffId,
  className,
  showEmailForm = true,
}: SendToPhoneCtaProps): ReactElement {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SendState>("idle");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [handoffId, setHandoffId] = useState<string | null>(
    providedHandoffId ?? null,
  );
  const qrTracked = useRef(false);

  useEffect(() => {
    setHandoffId(
      (current) => current ?? providedHandoffId ?? crypto.randomUUID(),
    );
  }, [providedHandoffId]);

  const qrValue = useMemo(() => {
    if (!handoffId) return null;

    return buildSmartQrHandoffUrl({
      source,
      surface,
      placement,
      handoff_id: handoffId,
      qr_id: qrId ?? `${surface}_${placement}_qr`,
      target: target ?? "download",
      utm_medium: "desktop_handoff",
    });
  }, [handoffId, placement, qrId, source, surface, target]);

  useEffect(() => {
    if (!handoffId || !qrValue || qrTracked.current) return;
    qrTracked.current = true;
    trackAppHandoffQrRendered({
      source,
      surface,
      placement,
      handoff_id: handoffId,
      variant,
      cohort,
      platform: "desktop",
      destination_type: "app_handoff",
      qr_id: qrId ?? `${surface}_${placement}_qr`,
      target: target ?? "download",
    });
  }, [
    cohort,
    handoffId,
    placement,
    qrId,
    qrValue,
    source,
    surface,
    target,
    variant,
  ]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setInlineError(null);

    if (!EMAIL_RE.test(email)) {
      setInlineError("Enter a valid email address.");
      setState("idle");
      return;
    }

    if (!handoffId) return;

    const emailDomain = email.split("@")[1] ?? "";
    setState("sending");
    trackAppHandoffEmailSubmit({
      source,
      surface,
      placement,
      handoff_id: handoffId,
      variant,
      cohort,
      platform: "desktop",
      email_domain: emailDomain,
    });

    try {
      const response = await fetch("/api/app-link-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          handoff_id: handoffId,
          source,
          surface,
          placement,
        }),
      });

      if (!response.ok) {
        setState(response.status === 429 ? "rate_limited" : "error");
        trackAppHandoffEmailFailed({
          source,
          surface,
          placement,
          handoff_id: handoffId,
          variant,
          cohort,
          platform: "desktop",
          email_domain: emailDomain,
        });
        return;
      }

      setState("sent");
      trackAppHandoffEmailSent({
        source,
        surface,
        placement,
        handoff_id: handoffId,
        variant,
        cohort,
        platform: "desktop",
        email_domain: emailDomain,
      });
    } catch {
      setState("error");
      trackAppHandoffEmailFailed({
        source,
        surface,
        placement,
        handoff_id: handoffId,
        variant,
        cohort,
        platform: "desktop",
        email_domain: emailDomain,
      });
    }
  }

  const statusCopy =
    state === "sent"
      ? "Check your email, then open it on your phone."
      : state === "rate_limited"
        ? "Too many attempts. Scan the QR code or try again later."
        : state === "error"
          ? "Could not send the link. Try again or scan the QR code."
          : null;

  return (
    <div
      className={cn(
        "rounded-[1.25rem] border-2 border-[#11100D] bg-[#EFE5CF] p-6 text-[#11100D] shadow-[5px_6px_0_#11100D]",
        className,
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="mx-auto shrink-0 -rotate-1 rounded-[1.1rem] border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[3px_3px_0_#11100D]">
          {qrValue ? (
            <QRCodeSVG
              aria-label="Scan to open Quiver on your phone"
              data-testid="app-handoff-qr"
              data-smart-url={qrValue}
              value={qrValue}
              size={150}
              level="H"
              marginSize={3}
              bgColor="#F4EBD8"
              fgColor="#11100D"
              data-background-color="#F4EBD8"
              data-foreground-color="#11100D"
              imageSettings={{
                src: "/quiver-app-icon-128.png",
                width: 28,
                height: 28,
                excavate: true,
              }}
            />
          ) : (
            <div
              aria-label="Preparing Quiver handoff"
              className="size-[150px]"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-sans text-sm leading-6 text-current opacity-80">
            {showEmailForm
              ? "Scan to get Quiver on your phone, or email yourself the link."
              : "Scan with your phone to open Quiver."}
          </p>

          {showEmailForm ? (
            <form onSubmit={onSubmit} className="mt-3" noValidate>
              <label
                htmlFor="send-to-phone-email"
                className="block font-sans text-xs font-semibold uppercase tracking-widest text-current opacity-65"
              >
                Your email
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  id="send-to-phone-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@email.com"
                  // Body carries .theme-retro-dark, whose `input` rule is
                  // !important. This attribute is the repo's opt-out for inputs
                  // rendered on zine cream paper (app/styles/zine.css).
                  data-zine-input="true"
                  className="min-h-11 flex-1 rounded-md border border-[#11100D] bg-[#F4EBD8] px-3 font-sans text-base text-[#11100D] placeholder:text-[#11100D]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
                />
                <button
                  type="submit"
                  disabled={state === "sending" || !handoffId}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#11100D] bg-ocean-blue-decorative px-5 font-sans text-base font-bold text-[#11100D] transition hover:bg-[#D57835] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11100D] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF] active:bg-[#C06A25] disabled:opacity-60"
                >
                  {state === "sending" ? "Sending..." : "Send link"}
                </button>
              </div>

              <div
                aria-live="polite"
                className="mt-2 min-h-5 font-sans text-sm"
              >
                {inlineError ? (
                  <span className="text-[#9A3412]">{inlineError}</span>
                ) : null}
                {statusCopy ? (
                  <span
                    className={
                      state === "sent"
                        ? "text-[#006B5F]"
                        : "text-[#9A3412]"
                    }
                  >
                    {statusCopy}
                  </span>
                ) : null}
              </div>
            </form>
          ) : null}

          <a
            href={IOS_APP_STORE_WEB_REDIRECT_PATH}
            className="mt-2 inline-block font-sans text-sm text-current opacity-75 underline underline-offset-2 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE5CF]"
          >
            Open App Store anyway
          </a>
        </div>
      </div>
    </div>
  );
}
