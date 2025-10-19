/**
 * Performance utilities for optimizing app performance
 */

import React from "react";

// Preload critical resources
export function preloadResource(href: string, as: string, type?: string) {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = href;
  link.as = as;
  if (type) link.type = type;

  document.head.appendChild(link);
}

// Preload images for better LCP
export function preloadImage(src: string, sizes?: string) {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = src;
  link.as = "image";
  if (sizes) link.setAttribute("imagesizes", sizes);

  document.head.appendChild(link);
}

// Critical resource preloading for homepage
export function preloadCriticalResources() {
  if (typeof window === "undefined") return;

  // Preload critical hero image (actual file used in hero)
  preloadImage("/logoQuiver.png", "100vw");
  
  // Preload critical images for LCP optimization
  preloadImage("/logo-word (2).png", "(max-width: 768px) 100vw, 50vw");

  // Preconnect to critical third-party domains for faster resource loading
  if (typeof window !== "undefined") {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = "https://fonts.gstatic.com";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}

// Lazy load images with intersection observer
export function createImageObserver(
  callback: (entries: IntersectionObserverEntry[]) => void
) {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    return null;
  }

  return new IntersectionObserver(callback, {
    rootMargin: "50px 0px", // Start loading 50px before the image comes into view
    threshold: 0.01,
  });
}

// Performance monitoring
export function measurePerformance(
  name: string,
  fn: () => void | Promise<void>
) {
  if (typeof window === "undefined" || !("performance" in window)) {
    return fn();
  }

  const startTime = performance.now();
  const result = fn();

  if (result instanceof Promise) {
    return result.finally(() => {
      const endTime = performance.now();
      console.log(`⚡ ${name}: ${(endTime - startTime).toFixed(2)}ms`);
    });
  }

  const endTime = performance.now();
  console.log(`⚡ ${name}: ${(endTime - startTime).toFixed(2)}ms`);
  return result;
}

// Debounced function for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

// Throttled function for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Resource loading optimization
export function loadScriptAsync(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    document.head.appendChild(script);
  });
}

// Component performance optimization
export function withPerformanceLogging<P extends object>(
  Component: React.ComponentType<P>,
  name: string
) {
  return function PerformanceWrapper(props: P) {
    const startTime = performance.now();

    React.useEffect(() => {
      const endTime = performance.now();
      console.log(
        `🎯 Component ${name} render time: ${(endTime - startTime).toFixed(
          2
        )}ms`
      );
    });

    return React.createElement(Component, props);
  };
}

// Core Web Vitals tracking
export function trackWebVitals() {
  if (typeof window === "undefined") return;

  import("web-vitals")
    .then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
      const vitalsHandler = (metric: any) => {
        // Log to console in development
        if (process.env.NODE_ENV === "development") {
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
  console.log("💾 Memory Usage:", {
    used: `${Math.round(memory.usedJSHeapSize / 1048576)} MB`,
    total: `${Math.round(memory.totalJSHeapSize / 1048576)} MB`,
    limit: `${Math.round(memory.jsHeapSizeLimit / 1048576)} MB`,
  });
}

// Export all utilities
export const PerformanceUtils = {
  preloadResource,
  preloadImage,
  preloadCriticalResources,
  createImageObserver,
  measurePerformance,
  debounce,
  throttle,
  loadScriptAsync,
  withPerformanceLogging,
  trackWebVitals,
  monitorMemoryUsage,
};
