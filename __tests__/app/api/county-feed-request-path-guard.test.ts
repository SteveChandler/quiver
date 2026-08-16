/**
 * @jest-environment node
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("County feed request-path boundary", () => {
  it("keeps the County endpoint and fetcher out of pages, actions, and components", () => {
    const requestPaths = [
      ...sourceFiles("app").filter((path) => !path.includes("/api/cron/")),
      ...sourceFiles("actions"),
      ...sourceFiles("components"),
      ...sourceFiles("lib").filter(
        (path) => !path.includes("/services/county-beach-advisories/"),
      ),
    ];
    const forbidden = [
      "cosdapps.sandiegocounty.gov",
      "createCountyFeedFetcher",
      "ActionGetSitesByTypeNotification",
    ];

    for (const path of requestPaths) {
      const source = readFileSync(path, "utf8");
      for (const token of forbidden) {
        expect(source).not.toContain(token);
      }
    }
  });
});
