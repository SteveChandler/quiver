/**
 * @jest-environment node
 */

const fs = require("node:fs");
const path = require("node:path");

const SHARED_AUTH_RUNNERS = [
  "runHomeBeachPushCron",
  "runEnhancedForecastSync",
  "runEnhancedForecastSyncCdip",
  "runEnhancedForecastSyncCdipHead",
  "runEnhancedForecastSyncHead",
];

const STALE_CRON_HEADER_PATTERNS = [
  /x-vercel-cron/i,
  /Vercel cron header/i,
];

function routePathForCronPath(cronPath) {
  const pathname = cronPath.split("?")[0].replace(/^\/+/, "");
  return path.join(process.cwd(), "app", pathname, "route.ts");
}

function collectTestFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTestFiles(entryPath);
    }
    if (!/\.(test|spec)\.[jt]sx?$/.test(entry.name)) {
      return [];
    }
    return [entryPath];
  });
}

describe("Vercel cron authentication", () => {
  it("routes every configured cron through shared cron auth", () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"),
    );

    const unauthenticatedRoutes = [];

    for (const cron of config.crons) {
      const routePath = routePathForCronPath(cron.path);
      if (!fs.existsSync(routePath)) {
        unauthenticatedRoutes.push(`${cron.path} -> missing ${routePath}`);
        continue;
      }

      const source = fs.readFileSync(routePath, "utf8");
      const usesDirectAuth = source.includes("validateCronRequest");
      const usesSharedAuthRunner = SHARED_AUTH_RUNNERS.some((runner) =>
        source.includes(runner),
      );

      if (!usesDirectAuth && !usesSharedAuthRunner) {
        unauthenticatedRoutes.push(cron.path);
      }
    }

    expect(unauthenticatedRoutes).toEqual([]);
  });

  it("does not preserve x-vercel-cron as accepted cron auth in route tests", () => {
    const testDirectories = [
      path.join(process.cwd(), "__tests__", "api", "cron"),
      path.join(process.cwd(), "__tests__", "app", "api", "cron"),
    ];
    const allowedFiles = new Set([
      path.join(process.cwd(), "__tests__", "api", "cron", "cron-auth.test.ts"),
    ]);
    const staleReferences = [];

    for (const testDirectory of testDirectories) {
      for (const testPath of collectTestFiles(testDirectory)) {
        if (allowedFiles.has(testPath)) continue;

        const source = fs.readFileSync(testPath, "utf8");
        if (STALE_CRON_HEADER_PATTERNS.some((pattern) => pattern.test(source))) {
          staleReferences.push(path.relative(process.cwd(), testPath));
        }
      }
    }

    expect(staleReferences).toEqual([]);
  });

  it("does not expose legacy Vercel cron header auth helpers", () => {
    const helperPath = path.join(
      process.cwd(),
      "__tests__",
      "setup",
      "cron-test-utils.ts",
    );
    const source = fs.readFileSync(helperPath, "utf8");

    expect(source).not.toContain("vercel-header");
    expect(source).not.toContain("x-vercel-cron");
  });
});
