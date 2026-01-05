import type { APIRequestContext, TestInfo } from "@playwright/test";

function hashToByte(input: string): number {
  // Deterministic, low-collision hash for stable per-test IP selection.
  // Produces a value in [1, 254] suitable for the last octet of an IPv4 address.
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return (hash % 254) + 1;
}

/**
 * Create an APIRequestContext isolated from other tests' rate-limit buckets.
 *
 * Our API rate limiter uses `x-forwarded-for` to identify the client. In local/E2E,
 * Playwright requests may not include that header, causing the identifier to fall
 * back to "unknown" and making unrelated tests share a single rate-limit bucket.
 *
 * This helper sets a deterministic per-test `x-forwarded-for` in TEST-NET-3
 * (`203.0.113.0/24`) so contract/validation tests remain stable while explicit
 * rate-limit tests can still assert 429 behavior within a single test.
 */
export async function createIsolatedApiContext(
  // NOTE: The Playwright Test `playwright` fixture type is intentionally `unknown` here to
  // avoid coupling this helper to a specific @playwright/test type export surface.
  // Runtime behavior is validated by the E2E suite itself.
  playwright: any,
  baseURL: string,
  testInfo: TestInfo,
  options?: {
    storageState?: any;
    extraHTTPHeaders?: Record<string, string>;
  }
): Promise<APIRequestContext> {
  const titlePath =
    typeof (testInfo as any).titlePath === "function"
      ? ((testInfo as any).titlePath() as string[])
      : (Array.isArray((testInfo as any).titlePath)
          ? ((testInfo as any).titlePath as string[])
          : null);

  const stableKey = `${(titlePath ?? [testInfo.title]).join(" > ")}|w${testInfo.workerIndex}`;
  const ip = `203.0.113.${hashToByte(stableKey)}`;

  return await playwright.request.newContext({
    baseURL,
    storageState: options?.storageState,
    extraHTTPHeaders: {
      "x-forwarded-for": ip,
      ...(options?.extraHTTPHeaders ?? {}),
    },
  });
}


