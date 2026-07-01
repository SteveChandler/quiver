/**
 * Performance utilities for optimizing app performance
 */

// Critical resource preloading for homepage
function preloadCriticalResources() {
  if (typeof window === "undefined") return () => {};

  // Note: logo preloads removed to prevent unused preload warnings on non-landing pages
  // - quiver-app-icon.png: loaded via Next.js Image with priority on landing page
  //
  // If landing-page-specific preload is needed in the future, make this function
  // accept an opts param: preloadCriticalResources({ isLandingPage: true })

  // Preconnect to critical third-party domains for faster resource loading
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.gstatic.com";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }

  // Preconnects are idempotent, return no-op cleanup
  return () => {};
}

// Optional debug flag for performance logging
const DEBUG_PERF = process.env.NEXT_PUBLIC_DEBUG_PERF === "true";

function trackWebVitals() {
  return () => {};
}

// Memory usage monitoring
function monitorMemoryUsage() {
  if (
    typeof window === "undefined" ||
    !("performance" in window) ||
    !("memory" in (window.performance as any))
  ) {
    return;
  }

  const memory = (window.performance as any).memory;
  
  // Only log if debug flag is enabled
  if (DEBUG_PERF) {
    console.log("💾 Memory Usage:", {
      used: `${Math.round(memory.usedJSHeapSize / 1048576)} MB`,
      total: `${Math.round(memory.totalJSHeapSize / 1048576)} MB`,
      limit: `${Math.round(memory.jsHeapSizeLimit / 1048576)} MB`,
    });
  }
}

// Export all utilities
export const PerformanceUtils = {
  preloadCriticalResources,
  trackWebVitals,
  monitorMemoryUsage,
};
