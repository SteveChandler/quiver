import fs from "node:fs";
import path from "node:path";

import {
  buildStoreSnapshot,
  compareListingMetadata,
  parseAppStoreLookup,
} from "../../lib/seo/agent-workflow/store-snapshot";
import { currentAuditDate, resolveSeoAuditFile } from "../../lib/seo/agent-workflow/audit-paths";
import type { StoreListingSnapshot } from "../../lib/seo/agent-workflow/types";
import { fetchJsonWithRetry } from "./resilient-fetch";

const outputPath = getFlag("--output") ??
  resolveSeoAuditFile("STORE-SNAPSHOT.json", currentAuditDate());
const listingDocPath = path.join(process.cwd(), "..", "Brand-Vault", "marketing", "app-store-listing-v2.md");

const IOS_TARGETS = [
  { app: "Quiver", id: "6759300320", url: "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320" },
  { app: "Lazy Surfer", id: "1450887020", url: "https://apps.apple.com/us/app/lazy-surfer/id1450887020" },
  { app: "Swellify", id: "6470770160", url: "https://apps.apple.com/us/app/swellify/id6470770160" },
  { app: "Swell Scope", id: "6747609653", url: "https://apps.apple.com/us/app/swell-scope-surf-forecast/id6747609653" },
  { app: "Duune", id: "6747520789", url: "https://apps.apple.com/us/app/duune/id6747520789" },
  { app: "Surf Radar", id: "6747351042", url: "https://apps.apple.com/us/app/surf-radar/id6747351042" },
];

const ASO_KEYWORDS = [
  "free surf app",
  "surf forecast",
  "surf report",
  "waves",
  "swell",
  "session log",
  "surf tracker",
  "surf journal",
  "surf alerts",
  "surf spots",
  "custom spot",
  "tide chart",
  "wind forecast",
  "buoy",
  "swell scope",
];

void main();

async function main(): Promise<void> {
  const expectedListing = fs.existsSync(listingDocPath)
    ? fs.readFileSync(listingDocPath, "utf8")
    : "";
  const listings: StoreListingSnapshot[] = [];
  const missing: string[] = expectedListing ? [] : [listingDocPath];

  for (const target of IOS_TARGETS) {
    try {
      const raw = await fetchJson(`https://itunes.apple.com/lookup?id=${target.id}&country=us`);
      const snapshot = parseAppStoreLookup(raw, target.app, target.url);
      if (target.app === "Quiver") {
        snapshot.keywordRanks = await sampleKeywordRanks(target.id);
        snapshot.metadataDrift = expectedListing
          ? compareListingMetadata(expectedListing, snapshot)
          : [];
      }
      listings.push(snapshot);
    } catch (error) {
      missing.push(`${target.app} App Store lookup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const competitorDeltas = readCompetitorMemoryDeltas();
  writeJson(buildStoreSnapshot(new Date().toISOString(), listings, competitorDeltas, missing));
}

async function sampleKeywordRanks(appId: string): Promise<StoreListingSnapshot["keywordRanks"]> {
  const ranks: NonNullable<StoreListingSnapshot["keywordRanks"]> = [];
  for (const keyword of ASO_KEYWORDS) {
    try {
      const raw = await fetchJson(
        `https://itunes.apple.com/search?term=${encodeURIComponent(keyword)}&country=us&entity=software&limit=25`,
      );
      const results = isRecord(raw) && Array.isArray(raw.results) ? raw.results : [];
      const rank = results.findIndex((item) =>
        isRecord(item) && String(item.trackId) === appId,
      );
      ranks.push({
        keyword,
        rank: rank === -1 ? null : rank + 1,
        source: "sampled-app-store-search",
      });
    } catch {
      ranks.push({ keyword, rank: null, source: "sampled-app-store-search" });
    }
  }
  return ranks;
}

async function fetchJson(url: string): Promise<unknown> {
  return fetchJsonWithRetry(url, {
    headers: { "User-Agent": "QuiverSEOAutomation/1.0" },
  });
}

function readCompetitorMemoryDeltas(): string[] {
  const memoryPath = "/Users/stevenchandler/.codex/automations/competitor-research-refresh/memory.md";
  if (!fs.existsSync(memoryPath)) return [];
  const lines = fs.readFileSync(memoryPath, "utf8").trim().split(/\r?\n/);
  const start = Math.max(lines.findLastIndex((line) => line.startsWith("Run: ")), 0);
  return lines.slice(start).filter((line) => line.startsWith("- ")).slice(0, 12);
}

function writeJson(value: unknown): void {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}
