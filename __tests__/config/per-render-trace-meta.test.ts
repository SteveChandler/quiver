/** @jest-environment node */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Loads the real next.config.mjs as a production build, with a Sentry stand-in that
// sets the same option the real wrapper sets.
function loadProductionExperimental(): Record<string, unknown> {
  const configUrl = pathToFileURL(`${process.cwd()}/next.config.mjs`).href;
  const sentryMock = [
    "export const withSentryConfig = (config) => ({",
    "  ...config,",
    "  experimental: {",
    "    ...config.experimental,",
    "    clientTraceMetadata: ['baggage', 'sentry-trace', ...(config.experimental?.clientTraceMetadata || [])],",
    "  },",
    "});",
  ].join("\n");
  const loaderSource = [
    "const mocks = {",
    "  '@ducanh2912/next-pwa': 'export default () => (config) => config;',",
    `  '@sentry/nextjs': ${JSON.stringify(sentryMock)},`,
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
    "process.stdout.write(JSON.stringify(config.experimental ?? {}));",
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
        // Production validation requires a cron secret; this is a placeholder.
        CRON_SECRET: "test-cron-secret",
        VERCEL_ENV: "production",
      },
    },
  );
  return JSON.parse(output) as Record<string, unknown>;
}

describe("next.config per-render trace meta", () => {
  it("does not ask Next to print Sentry trace tags into server renders", () => {
    const experimental = loadProductionExperimental();

    expect(experimental).not.toHaveProperty("clientTraceMetadata");
    // The rest of the experimental block must pass through the wrapper.
    expect(experimental.optimizePackageImports).toEqual(expect.arrayContaining(["zod"]));
  });
});

describe("withoutPerRenderTraceMeta", () => {
  const load = async () => import("@/config/per-render-trace-meta.mjs");

  it("keeps trace keys that are not per-render Sentry values", async () => {
    const { withoutPerRenderTraceMeta } = await load();
    const result = withoutPerRenderTraceMeta({
      experimental: { clientTraceMetadata: ["baggage", "sentry-trace", "traceparent"], ppr: false },
    });

    expect(result.experimental).toEqual({ clientTraceMetadata: ["traceparent"], ppr: false });
  });

  it("handles the function form of a Next config", async () => {
    const { withoutPerRenderTraceMeta } = await load();
    const wrapped = withoutPerRenderTraceMeta(async () => ({
      experimental: { clientTraceMetadata: ["sentry-trace"] },
    }));

    expect(await wrapped()).toEqual({ experimental: {} });
  });

  it("returns a config without the option unchanged", async () => {
    const { withoutPerRenderTraceMeta } = await load();
    const config = { experimental: { ppr: false } };

    expect(withoutPerRenderTraceMeta(config)).toBe(config);
  });
});
