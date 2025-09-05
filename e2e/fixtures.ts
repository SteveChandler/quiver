import { test as base, expect } from "@playwright/test";

// Extend base test to automatically fail on console errors and page errors
export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Ensure tests start from a clean unauthenticated state and mark Playwright context
    await page.addInitScript(() => {
      try {
        // Mark that we're in a Playwright environment for components that adjust behavior
        // @ts-ignore
        (window as any).__PLAYWRIGHT__ = true;

        // Clear storages proactively before the app code runs
        try {
          localStorage.clear();
          sessionStorage.clear();

          // Explicitly remove Supabase auth tokens if present
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if ((key.startsWith("sb-") && key.endsWith("-auth-token")) || key.includes("supabase")) {
              localStorage.removeItem(key);
            }
          }
        } catch {}

        // Best-effort IndexedDB cleanup for common Supabase stores
        try {
          // These deletes are no-ops if DBs don't exist
          indexedDB.deleteDatabase("supabase-auth");
          indexedDB.deleteDatabase("Supabase-auth");
          indexedDB.deleteDatabase("supabase-cache");
        } catch {}

        // Clear Cache Storage (service worker caches) if available
        try {
          // @ts-ignore
          if (window.caches && typeof window.caches.keys === "function") {
            // @ts-ignore
            caches.keys().then((names: string[]) => {
              names.forEach((name) => caches.delete(name));
            });
          }
        } catch {}
      } catch {}
    });

    const ignorePatterns = [
      /Failed to fetch RSC payload/i,
      /Failed to load resource: the server responded with a status of 404/i,
      /favicon\.ico/i,
      /Error: aborted/i,
      /Invalid or unexpected token/i,
      /Error fetching comment count/i,
      /Failed to load comments: 500/i,
      /the server responded with a status of 500.*comments/i,
    ];

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (!ignorePatterns.some((re) => re.test(text))) {
        consoleErrors.push(text);
      }
    });

    page.on("pageerror", (error) => {
      const message = error?.message || String(error);
      if (!ignorePatterns.some((re) => re.test(message))) {
        pageErrors.push(message);
      }
    });

    await use(page);

    if (pageErrors.length > 0) {
      throw new Error(
        `Page errors detected during test:\n${pageErrors.join("\n")}`
      );
    }

    if (consoleErrors.length > 0) {
      throw new Error(
        `Console errors detected during test:\n${consoleErrors.join("\n")}`
      );
    }
  },
});

export { expect };


