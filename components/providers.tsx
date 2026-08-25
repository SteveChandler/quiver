"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ProfileProvider } from "@/context/profile-context";
import { LocationProvider } from "@/context/location-context";
import { SelectedBeachProvider } from "@/state/selectedBeach";
import { Suspense } from "react";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import dynamic from "next/dynamic";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
import { BeachFollowSyncBoundary } from "@/components/beach-follow";

// Google One Tap — dynamically imported, SSR disabled (requires browser APIs)
const GoogleOneTap = dynamic(
  () =>
    import("@/components/auth/google-one-tap").then((mod) => ({
      default: mod.GoogleOneTap,
    })),
  { ssr: false }
);

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
const PageTracker = dynamic(
  () =>
    import("@/components/page-tracker").then((mod) => ({
      default: mod.PageTracker,
    })),
  { ssr: false }
);
const ClientErrorTracker = dynamic(
  () =>
    import("@/components/providers/client-error-tracker").then((mod) => ({
      default: mod.ClientErrorTracker,
    })),
  { ssr: false }
);

// Toast systems
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/app-header";
import { IphoneAppBanner } from "@/components/app-store/iphone-app-banner";

/**
 * EmbedBodyOverride - Sets body styles for embed routes and cleans up on unmount.
 *
 * Embed widgets need overflow:hidden and transparent backgrounds. Since the root
 * layout no longer branches on pathname (to enable ISR), this client component
 * handles the embed body styles instead.
 */
function EmbedBodyOverride({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    // Remove theme class so .theme-retro-dark CSS overrides don't affect light embeds
    document.body.classList.remove("theme-retro-dark", "noise-texture-subtle");
    return () => {
      document.body.style.overflow = "";
      document.body.style.background = "";
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.body.classList.add("theme-retro-dark", "noise-texture-subtle");
    };
  }, []);

  return <>{children}</>;
}

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
  const [allowUnauthedDebug, setAllowUnauthedDebug] = useState(false);

  // Read URL params on the client after mount to avoid SSR/client rendering bailouts
  // from using useSearchParams at the top-level.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-restricted-properties -- Reading URL on mount, not for navigation
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const params = url?.searchParams;
      setAllowUnauthedDebug(params?.get("showOnboarding") === "1");
    } catch {
      setAllowUnauthedDebug(false);
    }
  }, []);

  if (!user && !allowUnauthedDebug) return null;

  return (
    <>
      <Suspense fallback={null}>
        <OnboardingDialog />
      </Suspense>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const isWelcomePage = pathname === "/welcome";
  const isEmbedRoute = pathname.startsWith("/embed");

  // Embed routes get a minimal shell — no providers, nav, footer, or heavy assets.
  // Body styles are applied via EmbedBodyOverride since the root layout is now
  // non-async (no headers() call) to enable ISR caching across the site.
  if (isEmbedRoute) {
    return <EmbedBodyOverride>{children}</EmbedBodyOverride>;
  }

  // Note: We keep SelectedBeachProvider mounted even on "/"
  // so back/forward navigation doesn't destroy client caches and force refetches.

  return (
    <>
      {/* Auto-reload on stale chunk errors after deployments */}
      <ChunkErrorHandler />

      {/* Analytics Loader - Conditional based on route (handled internally) */}
      <Suspense fallback={null}>
        <AnalyticsLoader />
      </Suspense>

      <LocationProvider>
        <AuthProvider>
          <BeachFollowSyncBoundary />
          {/* Global body class manager for authenticated state */}
          <AuthBodyClassManager />
          {/* PostHog primary analytics + authenticated identity bridge */}
          <PostHogProvider />
          {/* Google One Tap sign-in prompt for anonymous web visitors */}
          <Suspense fallback={null}>
            <GoogleOneTap />
          </Suspense>
          {/* Page view tracking for engagement analytics */}
          <Suspense fallback={null}>
            <PageTracker />
          </Suspense>
          {/* Captures window.onerror + unhandledrejection as client_error events */}
          <Suspense fallback={null}>
            <ClientErrorTracker />
          </Suspense>
          <ProfileProvider>
            {/* Auth-only overlays (do not mount when logged out) */}
            <AuthOverlays />

            <SelectedBeachProvider>
              {isWelcomePage ? (
                /* Welcome/onboarding — full-screen, no nav or footer */
                <>{children}</>
              ) : !isLandingPage ? (
                <AuthenticatedAppContent>
                  {children}
                </AuthenticatedAppContent>
              ) : (
                /* Landing Page Optimized Path */
                <LandingPageContent>
                  {children}
                </LandingPageContent>
              )}
            </SelectedBeachProvider>
          </ProfileProvider>
        </AuthProvider>
      </LocationProvider>
    </>
  );
}

function AuthenticatedAppContent({
  children,
}: {
  children: React.ReactNode;
}) {
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
      <IphoneAppBanner />
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
              } catch(e) { console.warn('Confetti script error:', e); }
            })();
          `,
        }}
      />
    </>
  );
}

function LandingPageContent({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <AppHeader />
      </Suspense>
      <IphoneAppBanner />
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
