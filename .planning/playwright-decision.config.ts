import base from "../playwright.config";
import { defineConfig } from "@playwright/test";
export default defineConfig({ ...base, testDir: "../e2e", globalSetup: undefined, globalTeardown: undefined, webServer: undefined, workers: 1, retries: 0, use: { ...base.use, baseURL: "http://localhost:3188" }, reporter: [["list"]] });
