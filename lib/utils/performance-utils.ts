/**
 * Performance utilities for optimizing app performance
 */

// Critical resource preloading for homepage
export function preloadCriticalResources() {
  if (typeof window === "undefined") return () => {};

  // Note: logo preloads removed to prevent unused preload warnings on non-landing pages
  // - logoQuiver.png: loaded via Next.js Image with priority on landing page
  // - logo-word (2).png: 39KB PNG loads fast enough without preload optimization
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

// Track if vitals have been initialized to prevent duplicates
let vitalsInitialized = false;

// Core Web Vitals tracking
export function trackWebVitals() {
  if (typeof window === "undefined") return () => {};
  if (vitalsInitialized) return () => {};

  vitalsInitialized = true;

  import("web-vitals")
    .then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      const vitalsHandler = (metric: any) => {
        // Optional: log if debug flag is set
        if (DEBUG_PERF) {
          console.log(`📊 ${metric.name}:`, metric.value);
        }

        // Send to analytics in production
        if (
          process.env.NODE_ENV === "production" &&
          typeof window !== "undefined" &&
          typeof (window as any).gtag === "function"
        ) {
          (window as any).gtag("event", metric.name, {
            event_category: "Web Vitals",
            event_label: metric.id,
            value: Math.round(
              metric.name === "CLS" ? metric.value * 1000 : metric.value
            ),
            non_interaction: true,
          });
        }
      };

      onCLS(vitalsHandler);
      onFID(vitalsHandler);
      onFCP(vitalsHandler);
      onLCP(vitalsHandler);
      onTTFB(vitalsHandler);
    })
    .catch((error) => {
      console.warn("Web Vitals tracking failed:", error);
    });

  return () => {
    // Cleanup: reset flag if needed for re-initialization
    vitalsInitialized = false;
  };
}

// Memory usage monitoring
export function monitorMemoryUsage() {
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
