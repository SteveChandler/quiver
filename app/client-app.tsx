"use client";

/**
 * Client-side app wrapper that handles authentication routing.
 * Restored to fix personalized forecast feature issue.
 *
 * Routes between:
 * - HomeScreen for authenticated users
 * - LandingPageServer for unauthenticated users
 */

import { useAuth } from "@/context/auth-context";
import { useEffect, useRef, useState } from "react";
import { AuthLoadingStates } from "@/lib/utils/loading-utils";
import { PerformanceUtils } from "@/lib/utils/performance-utils";
import { HomeScreen } from "@/components/home-screen";
import LandingPage from "@/components/landing-page";

// Performance-optimized loading component
function ComponentLoadingFallback({ type }: { type: "home" | "landing" }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="loading-spinner mx-auto" />
        <p className="text-muted-foreground">
          Loading {type === "home" ? "Dashboard" : "Quiver"}...
        </p>
      </div>
    </div>
  );
}

// Error boundary component for better UX
function ComponentErrorFallback({
  error,
  type,
}: {
  error: Error;
  type: "home" | "landing";
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground">
          Failed to load {type === "home" ? "dashboard" : "page"}. Please
          refresh the page.
        </p>
        <button
          onClick={() => window.location.reload()} // eslint-disable-line no-restricted-properties
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}

export default function ClientApp() {
  const { user, isLoading } = useAuth();
  const didInit = useRef(false);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Check returning user flag from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsReturningUser(localStorage.getItem("quiver_returning_user") === "true");
    }
  }, []);

  // Initialize performance monitoring and preload critical resources
  useEffect(() => {
    // Prevent double initialization even in StrictMode
    if (didInit.current) return;
    didInit.current = true;

    // Initialize with cleanup functions
    const vitalsCleanup = PerformanceUtils.trackWebVitals();
    const preloadCleanup = PerformanceUtils.preloadCriticalResources();

    let memTimer: ReturnType<typeof setTimeout> | null = null;
    if (process.env.NODE_ENV === "development") {
      memTimer = setTimeout(() => {
        PerformanceUtils.monitorMemoryUsage();
      }, 5000);
    }

    return () => {
      vitalsCleanup?.();
      preloadCleanup?.();
      if (memTimer) clearTimeout(memTimer);
    };
  }, []);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return AuthLoadingStates.checking();
  }

  // Render appropriate component with performance optimizations
  if (user) {
    return <HomeScreen />;
  }

  return <LandingPage autoOpenLogin={isReturningUser} />;
}
