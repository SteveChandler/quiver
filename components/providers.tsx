"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/auth-context";
import { ProfileProvider } from "@/context/profile-context";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { SelectedBeachProvider } from "@/state/selectedBeach";
import { Suspense } from "react";
import { AnalyticsLoader } from "@/components/analytics/analytics-loader";
import dynamic from "next/dynamic";

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

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

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
        <ProfileProvider>
          {/* Global components that require auth context but should be present on all routes */}
          <Suspense fallback={null}>
            <OnboardingDialog />
          </Suspense>
          <Suspense fallback={null}>
            <ProductTour />
          </Suspense>

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
