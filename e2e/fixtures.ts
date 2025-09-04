import { test as base, expect } from "@playwright/test";

// Extend base test to automatically fail on console errors and page errors
export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

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


