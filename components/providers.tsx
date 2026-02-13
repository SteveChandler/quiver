"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ProfileProvider } from "@/context/profile-context";
import { LocationProvider } from "@/context/location-context";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { SelectedBeachProvider } from "@/state/selectedBeach";
import { Suspense } from "react";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import dynamic from "next/dynamic";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";

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
const PageTracker = dynamic(
  () =>
    import("@/components/page-tracker").then((mod) => ({
      default: mod.PageTracker,
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
  const [allowUnauthedDebug, setAllowUnauthedDebug] = useState(false);

  // Read URL params on the client after mount to avoid SSR/client rendering bailouts
  // from using useSearchParams at the top-level.
  useEffect(() => {
    try {
      // eslint-disable-next-line no-restricted-properties -- Reading URL on mount, not for navigation
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const params = url?.searchParams;
      setAllowUnauthedDebug(
        params?.get("showOnboarding") === "1" || params?.get("showTour") === "1"
      );
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
      <Suspense fallback={null}>
        <ProductTour />
      </Suspense>
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  // Note: We keep ReactQuery + SelectedBeachProvider mounted even on "/"
  // so back/forward navigation doesn't destroy client caches and force refetches.
  // We still keep the landing UI path lightweight by controlling *what renders*,
  // not by unmounting the caching providers.

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
          {/* Global body class manager for authenticated state */}
          <AuthBodyClassManager />
          {/* Page view tracking for engagement analytics */}
          <Suspense fallback={null}>
            <PageTracker />
          </Suspense>
          <ProfileProvider>
            {/* Auth-only overlays (do not mount when logged out) */}
            <AuthOverlays />

            <ReactQueryProvider>
              <SelectedBeachProvider>
                {!isLandingPage ? (
                  <AuthenticatedAppContent>{children}</AuthenticatedAppContent>
                ) : (
                  /* Landing Page Optimized Path */
                  <LandingPageContent>{children}</LandingPageContent>
                )}
              </SelectedBeachProvider>
            </ReactQueryProvider>
          </ProfileProvider>
        </AuthProvider>
      </LocationProvider>
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
              } catch(e) { console.warn('Confetti script error:', e); }
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
