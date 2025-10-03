"use client";

import { useAuth } from "@/context/auth-context";
import { useEffect } from "react";
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
          onClick={() => window.location.reload()}
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

  // Initialize performance monitoring and preload critical resources
  useEffect(() => {
    // Track Web Vitals
    PerformanceUtils.trackWebVitals();

    // Preload critical resources for better LCP
    PerformanceUtils.preloadCriticalResources();

    // Monitor memory usage in development
    if (process.env.NODE_ENV === "development") {
      setTimeout(() => {
        PerformanceUtils.monitorMemoryUsage();
      }, 5000);
    }
  }, []);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return AuthLoadingStates.checking();
  }

  // Render appropriate component with performance optimizations
  if (user) {
    return <HomeScreen />;
  }

  return <LandingPage />;
}
