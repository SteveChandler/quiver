"use client";

import { useEffect } from "react";

const EMAIL_BRIDGE_KEYS = [
  "email_type",
  "message_instance_id",
];

function firstParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key);
  return value && value.trim().length > 0 ? value : null;
}

export function isSessionEmailAppBridgeRequest(
  searchParams: URLSearchParams
): boolean {
  if (firstParam(searchParams, "entrySource") === "email") return true;
  if (firstParam(searchParams, "utm_source") === "email") return true;
  if (firstParam(searchParams, "utm_medium") === "email") return true;
  return EMAIL_BRIDGE_KEYS.some((key) => firstParam(searchParams, key) !== null);
}

export function buildSessionNativeAppUrl(searchParams: URLSearchParams): string {
  const nativeParams = new URLSearchParams(searchParams.toString());
  nativeParams.set("entrySource", "email");
  nativeParams.set("native_handoff", "web_email_bridge");
  return `quiver://sessions/new?${nativeParams.toString()}`;
}

export function buildSessionEmailWebSignInUrl(
  searchParams: URLSearchParams
): string {
  const redirectTo = `/sessions/new?${searchParams.toString()}`;
  const signInParams = new URLSearchParams({ redirectTo });
  return `/auth/sign-in?${signInParams.toString()}`;
}

function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

interface EmailSessionAppBridgeProps {
  appUrl: string;
  signInUrl: string;
  isAuthenticated: boolean;
  onContinueWeb: () => void;
  autoAttempt?: boolean;
}

export function EmailSessionAppBridge({
  appUrl,
  signInUrl,
  isAuthenticated,
  onContinueWeb,
  autoAttempt = true,
}: EmailSessionAppBridgeProps) {
  useEffect(() => {
    if (!autoAttempt || typeof window === "undefined") return;
    if (!isMobileUserAgent(window.navigator.userAgent)) return;

    const storageKey = `quiver-email-app-bridge:${appUrl}`;
    if (window.sessionStorage.getItem(storageKey) === "attempted") return;

    window.sessionStorage.setItem(storageKey, "attempted");
    const timeoutId = window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = appUrl;
      link.rel = "noreferrer";
      link.click();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [appUrl, autoAttempt]);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">
          Quiver
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight">
          Open this session in the app
        </h1>
        <p className="mt-4 text-base leading-7 text-white/72">
          This link came from email. If Quiver is installed, open the app to log
          the session with attribution intact.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href={appUrl}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-orange-400 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-orange-300"
          >
            Open Quiver app
          </a>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={onContinueWeb}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/16 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10 focus-ring"
            >
              Continue on web
            </button>
          ) : (
            <a
              href={signInUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/16 px-5 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              Continue on web
            </a>
          )}
        </div>

        <p className="mt-5 text-sm leading-6 text-white/50">
          If nothing happens, tap Open Quiver app once more.
        </p>
      </div>
    </main>
  );
}
