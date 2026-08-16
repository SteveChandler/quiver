"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { hasSupabaseAuthCookie } from "@/lib/utils/supabase-cookie-utils";
import { BODY_CLASSES, PERFORMANCE_TIMING } from "@/lib/constants/css-classes";
import { Navbar } from "@/components/landing-page/navbar";
import { QuiverFieldGuideLanding } from "@/components/landing-page/field-guide/quiver-field-guide-landing";
import { HomeZineLoading } from "@/components/oracle/zine/home-zine-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import {
  getFirstTouchPlatform,
  type FirstTouchPlatform,
} from "@/lib/analytics/web-context";

const OracleHomeScreenDynamic = dynamic(
  () =>
    import("@/components/oracle/oracle-home-screen").then(
      (m) => m.OracleHomeScreen
    ),
  {
    ssr: false,
    loading: () => <HomeZineLoading />,
  }
);

/**
 * AuthAwareLandingWrapper Component
 *
 * A client component that handles authentication-based routing within the SSR shell.
 *
 * Behavior:
 * - Loading state: Shows auth loading spinner while checking authentication
 * - Authenticated: Renders the full HomeScreen dashboard
 * - Unauthenticated: Renders interactive landing page sections (including mobile apps)
 *
 * Special Cases:
 * - Signup Confirmation (`?signup=confirm-email`): Bypasses auth loading screen
 *   to show landing page with confirmation modal, even while auth is initializing.
 *   Modal requires user action ("Got it" button) to dismiss, ensuring visibility.
 *
 * Progressive Enhancement:
 * - Manages `js-loaded` body class to hide SSR beach section when client renders
 * - SSR beach section remains for SEO crawlers and no-JS fallback
 * - `authenticated` body class is managed globally by AuthBodyClassManager
 *
 * Note: PopularBeachesSection and SiteFooter are rendered in the server shell
 * to ensure beach links are always in the HTML for SEO purposes.
 */
interface AuthAwareLandingWrapperProps {
  initialPlatform?: FirstTouchPlatform;
  appFirst?: boolean;
}

export function AuthAwareLandingWrapper({
  initialPlatform = "desktop",
  appFirst = true,
}: AuthAwareLandingWrapperProps = {}): ReactElement {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const didShowSignupModalRef = useRef(false);
  const [hasAuthCookie, setHasAuthCookie] = useState(false);
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [platform, setPlatform] =
    useState<FirstTouchPlatform>(initialPlatform);

  // Resolved after mount, for the same reason as the auth-cookie check below:
  // SSR and the first client render must agree. `initialPlatform` is the
  // pre-hydration default; the real value only affects analytics params on the
  // download links, so correcting it a tick later is invisible.
  useEffect(() => {
    setPlatform(getFirstTouchPlatform());
  }, []);

  // Reactive: updates when URL parameters change via soft navigation
  const isConfirmEmailSignup = searchParams.get("signup") === "confirm-email";

  // Detect auth cookies after mount only, so SSR + first client render match (prevents hydration mismatch).
  useEffect(() => {
    setHasAuthCookie(hasSupabaseAuthCookie());
  }, []);

  // Show post-signup confirm-email modal on landing.
  useEffect(() => {
    if (searchParams.get("signup") !== "confirm-email") return;
    if (didShowSignupModalRef.current) return;

    didShowSignupModalRef.current = true;
    setShowEmailConfirmModal(true);
  }, [searchParams]);

  // Handle modal dismissal: clean the URL
  const handleEmailConfirmModalDismiss = () => {
    setShowEmailConfirmModal(false);

    // Remove the signup param while preserving other query params (e.g., UTM tracking)
    const params = new URLSearchParams(searchParams.toString());
    params.delete("signup");
    const cleanUrl = params.toString() ? `/?${params.toString()}` : "/";
    router.replace(cleanUrl);
  };

  // Initialize performance monitoring
  useEffect(() => {
    PerformanceUtils.trackWebVitals();
    PerformanceUtils.preloadCriticalResources();

    if (process.env.NODE_ENV === "development") {
      setTimeout(() => {
        PerformanceUtils.monitorMemoryUsage();
      }, PERFORMANCE_TIMING.MEMORY_MONITOR_DELAY_MS);
    }
  }, []);

  // Note: body.authenticated class management moved to AuthBodyClassManager in providers.tsx
  // This ensures the SSR beach section is hidden on ALL routes, not just the landing page

  // Hide SSR beach section when JS is loaded (client SurfHighlightsSection takes over)
  // This keeps the SSR version for SEO crawlers and no-JS fallback
  useEffect(() => {
    if (!user) {
      document.body.classList.add(BODY_CLASSES.JS_LOADED);
    }
    return () => {
      document.body.classList.remove(BODY_CLASSES.JS_LOADED);
    };
  }, [user]);

  // Show loading for authenticated users while auth resolves, but skip for signup confirmation
  const shouldShowAuthLoading =
    isLoading && hasAuthCookie && !(isConfirmEmailSignup && !user);

  if (shouldShowAuthLoading) {
    return <HomeZineLoading />;
  }

  // Authenticated users see the Oracle home screen
  if (user) {
    return <OracleHomeScreenDynamic />;
  }

  // Unauthenticated users see the interactive landing page sections
  // Note: SSR PopularBeachesSection is also rendered in layout.tsx for SEO crawlers,
  // but hidden via CSS (body.js-loaded) when this client version is available.
  return (
    <>
      <Navbar position="static" />

      <main role="main">
        <QuiverFieldGuideLanding
          platform={platform}
          appFirst={appFirst}
        />
      </main>

      {/* Email confirmation modal - requires user action to dismiss */}
      <Dialog open={showEmailConfirmModal} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Check your email</DialogTitle>
            <DialogDescription className="text-base pt-2">
              We sent a confirmation link to your email. Click the link to
              finish creating your account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={handleEmailConfirmModalDismiss} size="lg">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
