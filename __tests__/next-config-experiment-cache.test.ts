/** @jest-environment node */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

function loadHeaderRules(): HeaderRule[] {
  const rulesUrl = pathToFileURL(`${process.cwd()}/config/api-cache-header-rules.mjs`).href;
  const script = [
    `import { apiCacheHeaderRules } from ${JSON.stringify(rulesUrl)};`,
    "process.stdout.write(JSON.stringify(apiCacheHeaderRules));",
  ].join(" ");
  return JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
      encoding: "utf8",
    }),
  ) as HeaderRule[];
}

function effectiveExperimentCacheControl(path: string): string | undefined {
  const rules = loadHeaderRules();
  const matchingRules = rules.filter(({ source }) =>
    source === "/api/(.*)" || (source === "/api/v1/experiments/:path*" && path.startsWith("/api/v1/experiments/")),
  );

  return matchingRules.flatMap((rule) => rule.headers)
    .filter((header) => header.key.toLowerCase() === "cache-control")
    .at(-1)?.value;
}

describe("next.config experiment endpoint cache policy", () => {
  it("uses the ordered API cache rules in the effective Next configuration", () => {
    const nextConfig = readFileSync(`${process.cwd()}/next.config.mjs`, "utf8");
    expect(nextConfig).toContain("...apiCacheHeaderRules");
  });

  it.each([
    "/api/v1/experiments/assignment",
    "/api/v1/experiments/link",
  ])("applies no-store after the blanket API policy for %s", (path) => {
    expect(effectiveExperimentCacheControl(path)).toBe("private, no-store, no-cache, must-revalidate");
  });
});
