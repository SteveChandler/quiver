import { defineConfig } from "/Users/stevenchandler/Desktop/dev/quiver/node_modules/@playwright/test";
import base from "/Users/stevenchandler/Desktop/dev/quiver/.worktrees/native-audit-main-20260906/playwright.config";
export default defineConfig({ ...base, testDir: "/Users/stevenchandler/Desktop/dev/quiver/.worktrees/native-audit-main-20260906/e2e", globalSetup: undefined, globalTeardown: undefined, webServer: undefined, outputDir: "/tmp/overlay-verify-results", reporter: [["list"]] });
