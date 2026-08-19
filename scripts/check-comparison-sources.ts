import {
  COMPARISON_SOURCE_LINKS,
  type ComparisonSourceLink,
} from "../app/best-surf-forecast-app/comparison-sources";

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Hosts that answer automated checkers with 403/429 bot walls even when the
 * page is live (Apple rate-limits, Surfline/Zendesk block non-browser UAs).
 * A blocked response from these hosts is a WARN needing a manual look, not a
 * broken link; 404/410/redirects/5xx from them still fail.
 */
const BOT_PROTECTED_HOSTS = new Set([
  "apps.apple.com",
  "www.surfline.com",
  "support.surfline.com",
]);

function isBotWalledResponse(result: SourceCheckResult): boolean {
  if (result.status !== 403 && result.status !== 429) {
    return false;
  }
  try {
    return BOT_PROTECTED_HOSTS.has(new URL(result.source.href).hostname);
  } catch {
    return false;
  }
}

interface SourceCheckResult {
  source: ComparisonSourceLink;
  status: number | null;
  redirectLocation?: string;
  error?: string;
}

async function checkSource(
  source: ComparisonSourceLink,
): Promise<SourceCheckResult> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(source.href, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "QuiverComparisonSourceChecker/1.0",
      },
      redirect: "manual",
      signal: abortController.signal,
    });

    await response.body?.cancel();

    return {
      source,
      status: response.status,
      redirectLocation: response.headers.get("location") ?? undefined,
    };
  } catch (error) {
    return {
      source,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function describeFailure(result: SourceCheckResult): string | null {
  if (result.error) {
    return result.error;
  }

  if (result.status && result.status >= 300 && result.status < 400) {
    return `redirected (${result.status}) to ${result.redirectLocation ?? "an unspecified location"}`;
  }

  if (!result.status || result.status < 200 || result.status >= 300) {
    return `returned HTTP ${result.status ?? "unknown"}`;
  }

  return null;
}

async function main(): Promise<void> {
  const results = await Promise.all(
    COMPARISON_SOURCE_LINKS.map((source) => checkSource(source)),
  );
  let failureCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const failure = describeFailure(result);

    if (failure && isBotWalledResponse(result)) {
      warnCount += 1;
      console.warn(
        `WARN ${result.source.label}: ${failure} (bot-protected host — verify manually in a browser)`,
      );
      console.warn(`     ${result.source.href}`);
      continue;
    }

    if (failure) {
      failureCount += 1;
      console.error(`FAIL ${result.source.label}: ${failure}`);
      console.error(`     ${result.source.href}`);
      continue;
    }

    console.log(`PASS ${result.source.label}: HTTP ${result.status}`);
  }

  if (warnCount > 0) {
    console.warn(
      `\n${warnCount} bot-protected source(s) could not be verified automatically — open them in a browser during the review.`,
    );
  }

  if (failureCount > 0) {
    console.error(
      `\n${failureCount} of ${results.length} comparison source links failed. Review redirects and update a cited URL only after verifying the replacement source.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nAll ${results.length} comparison source links passed.`);
}

void main();
