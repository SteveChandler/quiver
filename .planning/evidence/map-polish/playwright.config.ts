import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config";
import path from "node:path";
export default defineConfig({
  ...base,
  testDir: path.resolve(__dirname, "../../../e2e"),
  globalSetup: undefined,
  globalTeardown: undefined,
  webServer: undefined,
  outputDir: path.resolve(__dirname, "results"),
  reporter: [["list"]],
});
