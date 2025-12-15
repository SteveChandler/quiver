"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ProfileProvider } from "@/context/profile-context";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { SelectedBeachProvider } from "@/state/selectedBeach";
import { Suspense } from "react";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import dynamic from "next/dynamic";

function shouldSendLocalAgentIngest(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  // eslint-disable-next-line no-restricted-properties
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// Capture early client-side errors (including hydration) before effects run.
if (typeof window !== "undefined") {
  const w = window as unknown as {
    __quiverConsolePatched?: boolean;
  };

  if (!w.__quiverConsolePatched) {
    w.__quiverConsolePatched = true;

    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    const postConsoleEvent = (level: "error" | "warn", args: unknown[]) => {
      if (!shouldSendLocalAgentIngest()) return;
      const first =
        typeof args?.[0] === "string"
          ? args[0]
          : args?.[0] &&
            typeof args?.[0] === "object" &&
            "message" in (args[0] as any)
          ? String((args[0] as any).message)
          : "[non-string console message]";

      // #region agent log (H5)
      fetch(
        "http://127.0.0.1:7242/ingest/34f14e6e-7bc2-48aa-9171-48f9e1984d59",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H5",
            location: "components/providers.tsx:consolePatch",
            message: "console event captured",
            data: {
              level,
              first: String(first).slice(0, 500),
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion agent log
    };

    console.error = (...args: unknown[]) => {
      postConsoleEvent("error", args);
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      postConsoleEvent("warn", args);
      originalWarn(...args);
    };
  }
}

// Dynamic imports for analytics components
const GoogleAnalytics = dynamic(
  () => import("@/components/analytics/google-analytics"),
  { ssr: false }
);
const PWAAndPushListeners = dynamic(
  () => import("@/components/analytics/pwa-and-push-listeners"),
  { ssr: false }
);
const OnboardingDialog = dynamic(
  () =>
    import("@/components/onboarding/onboarding-dialog").then((mod) => ({
      default: mod.OnboardingDialog,
    })),
  { ssr: false }
);
const ProductTour = dynamic(
  () =>
    import("@/components/onboarding/product-tour").then((mod) => ({
      default: mod.ProductTour,
    })),
  { ssr: false }
);

// Toast systems
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/app-header";

/**
 * AuthBodyClassManager - Manages body.authenticated class globally
 *
 * This component adds/removes the 'authenticated' class on the body element
 * based on the user's authentication state. This is used to hide the SSR
 * beach section (rendered in layout.tsx for SEO) via CSS when users are
 * logged in, regardless of which page they're on.
 *
 * This fixes the issue where the SSR section persists in the DOM during
 * client-side navigation from the landing page to other routes.
 */
function AuthBodyClassManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      document.body.classList.add("authenticated");
    } else {
      document.body.classList.remove("authenticated");
    }
    return () => {
      document.body.classList.remove("authenticated");
    };
  }, [user]);

  return null;
}

function AuthOverlays() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const allowUnauthedDebug =
    searchParams?.get("showOnboarding") === "1" ||
    searchParams?.get("showTour") === "1";

  if (!user && !allowUnauthedDebug) return null;

  return (
    <>
      <Suspense fallback={null}>
        <OnboardingDialog />
      </Suspense>
      <Suspense fallback={null}>
        <ProductTour />
      </Suspense>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (!shouldSendLocalAgentIngest()) return;
      // #region agent log (H5)
      fetch(
        "http://127.0.0.1:7242/ingest/34f14e6e-7bc2-48aa-9171-48f9e1984d59",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H5",
            location: "components/providers.tsx:windowError",
            message: "window error event captured",
            data: {
              message: event.message,
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              stack: event.error?.stack
                ? String(event.error.stack).slice(0, 2000)
                : null,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion agent log
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!shouldSendLocalAgentIngest()) return;
      // #region agent log (H5)
      fetch(
        "http://127.0.0.1:7242/ingest/34f14e6e-7bc2-48aa-9171-48f9e1984d59",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H5",
            location: "components/providers.tsx:unhandledRejection",
            message: "unhandled promise rejection captured",
            data: {
              reason:
                typeof event.reason === "string"
                  ? event.reason
                  : event.reason?.message
                  ? String(event.reason.message)
                  : "[non-string rejection]",
              stack: event.reason?.stack
                ? String(event.reason.stack).slice(0, 2000)
                : null,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion agent log
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  // For the landing page, we want a minimal provider tree to improve performance
  // Unauthenticated users on the landing page don't need:
  // - ReactQuery (mostly used for app data)
  // - SelectedBeachProvider (used for map/forecasts)
  // - Heavy analytics (handled by AnalyticsLoader)

  // However, we DO need AuthProvider to check session status

  return (
    <>
      {/* Analytics Loader - Conditional based on route (handled internally) */}
      <Suspense fallback={null}>
        <AnalyticsLoader />
      </Suspense>

      <AuthProvider>
        {/* Global body class manager for authenticated state */}
        <AuthBodyClassManager />
        <ProfileProvider>
          {/* Auth-only overlays (do not mount when logged out) */}
          <AuthOverlays />

          {/*
            Conditional rendering of heavy providers
            Only load ReactQuery and SelectedBeachProvider if NOT on landing page
            OR if we are authenticated (AuthProvider handles auth state internally,
            but we can't easily read it here at the top level without context)

            Strategy: Always load AuthProvider.
            Inside AuthProvider, we have the auth state.
            But here we are at the root.

            Compromise: Only skip these on the exact landing page route "/"
            This assumes most traffic to "/" is unauthenticated marketing traffic.
            Logged-in users will quickly navigate to /home or be redirected.
          */}

          {!isLandingPage ? (
            <ReactQueryProvider>
              <SelectedBeachProvider>
                <AuthenticatedAppContent>{children}</AuthenticatedAppContent>
              </SelectedBeachProvider>
            </ReactQueryProvider>
          ) : (
            /* Landing Page Optimized Path */
            <LandingPageContent>{children}</LandingPageContent>
          )}
        </ProfileProvider>
      </AuthProvider>
    </>
  );
}

function AuthenticatedAppContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <GoogleAnalytics />
      </Suspense>
      <Suspense fallback={null}>
        <PWAAndPushListeners />
      </Suspense>
      <Suspense fallback={null}>
        <AppHeader />
      </Suspense>
      <main id="main-content" role="main">
        {children}
      </main>
      <Toaster />
      <SonnerToaster />
      {/* Confetti script for E2E */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function(){
              try {
                window.confetti = window.confetti || function(){};
              } catch(_) {}
            })();
          `,
        }}
      />
    </>
  );
}

function LandingPageContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AppHeader />
      </Suspense>
      {/* PWA SW registration/unregistration (runtime-controlled; never on localhost) */}
      <Suspense fallback={null}>
        <PWAAndPushListeners />
      </Suspense>
      <main id="main-content" role="main">
        {children}
      </main>
      {/* 
        Minimal toasts for landing page interactions 
        (e.g. auth errors on login form)
      */}
      <Toaster />
      <SonnerToaster />
    </>
  );
}
