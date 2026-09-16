/** @jest-environment node */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

async function loadConfiguredHeaders(): Promise<HeaderRule[]> {
  const configUrl = pathToFileURL(`${process.cwd()}/next.config.mjs`).href;
  const loaderSource = [
    "const mocks = {",
    "  '@ducanh2912/next-pwa': 'export default () => (config) => config;',",
    "  '@sentry/nextjs': 'export const withSentryConfig = (config) => config;',",
    "};",
    "export async function resolve(specifier, context, nextResolve) {",
    "  if (mocks[specifier]) {",
    "    return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };",
    "  }",
    "  return nextResolve(specifier, context);",
    "}",
  ].join("\n");
  const loaderUrl = `data:text/javascript;base64,${Buffer.from(loaderSource).toString("base64")}`;
  const script = [
    `const { default: wrappedConfig } = await import(${JSON.stringify(configUrl)});`,
    "const config = typeof wrappedConfig === 'function'",
    "  ? await wrappedConfig('phase-production-build', { defaultConfig: {} })",
    "  : wrappedConfig;",
    "process.stdout.write(JSON.stringify(await config.headers()));",
  ].join("\n");
  const output = execFileSync(
    process.execPath,
    ["--experimental-loader", loaderUrl, "--input-type=module", "--eval", script],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
        NEXT_PUBLIC_SITE_URL: "https://example.com",
        VERCEL_ENV: "preview",
      },
    },
  );
  return JSON.parse(output) as HeaderRule[];
}

function resolvedCacheControl(path: string, rules: HeaderRule[]): string | undefined {
  // Uses Next's route matcher so this follows the emitted config's source syntax.
  const { getPathMatch } = require("next/dist/shared/lib/router/utils/path-match") as {
    getPathMatch: (source: string) => (pathname: string) => false | Record<string, string>;
  };
  const headers = new Headers();
  for (const rule of rules) {
    if (!getPathMatch(rule.source)(path)) continue;
    for (const header of rule.headers) headers.set(header.key, header.value);
  }

  return headers.get("Cache-Control") ?? undefined;
}

describe("next.config private endpoint cache policy", () => {
  it.each(["/api/cron/swell-watch-acquire", "/api/cron/swell-watch-evaluate"])(
    "emits no-store for the no-send operation %s", async (path) => {
      expect(resolvedCacheControl(path, await loadConfiguredHeaders()))
        .toBe("private, no-store, no-cache, must-revalidate");
    },
  );
  it("emits no-store for experiments while retaining the blanket policy for a control API path", async () => {
    const headers = await loadConfiguredHeaders();

    expect(resolvedCacheControl("/api/v1/experiments/assignment", headers))
      .toBe("private, no-store, no-cache, must-revalidate");
    expect(resolvedCacheControl("/api/v1/experiments/link", headers))
      .toBe("private, no-store, no-cache, must-revalidate");
    expect(resolvedCacheControl("/api/forecasts/update-enhanced", headers))
      .toBe("private, no-store, no-cache, must-revalidate");
    expect(resolvedCacheControl("/api/control-path", headers))
      .toBe("private, max-age=60, stale-while-revalidate=120");
  });
});
