import { readFile, writeFile } from "node:fs/promises";
import { FES2022_CITATION, computeMllwOffsetM, type ModelTideConstituent } from "../../lib/services/tides/model-tides";

export type RawPoint = {
  kind: "beach" | "reference";
  slug?: string;
  stationId?: string;
  lat?: number;
  lon?: number;
  constituents: ModelTideConstituent[];
};

export type RawExtraction = {
  model: "FES2022";
  points: Record<string, RawPoint>;
  unresolved: string[];
};

export function buildCatalog(raw: RawExtraction): {
  model: "FES2022";
  citation: string;
  beaches: Record<string, { mllwOffsetM: number; constituents: ModelTideConstituent[] }>;
} {
  if (raw.model !== "FES2022") throw new Error(`Unexpected model: ${raw.model}`);
  const beaches: Record<string, { mllwOffsetM: number; constituents: ModelTideConstituent[] }> = {};
  for (const [id, point] of Object.entries(raw.points)) {
    if (point.kind !== "beach") continue;
    if (!point.constituents?.length) throw new Error(`Beach ${id} has no constituents`);
    const constituents = point.constituents.map(({ name, amplitudeM, phaseDeg }) => {
      if (!Number.isFinite(amplitudeM) || !Number.isFinite(phaseDeg)) throw new Error(`Invalid constituent for ${id}: ${name}`);
      return { name, amplitudeM: Math.round(amplitudeM * 1e5) / 1e5, phaseDeg: Math.round(phaseDeg * 1e5) / 1e5 };
    });
    beaches[id] = { mllwOffsetM: computeMllwOffsetM(constituents), constituents };
  }
  return { model: "FES2022", citation: FES2022_CITATION, beaches };
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log("npx tsx --conditions=import scripts/tides/build-fes2022-constants.ts --raw extracted.json [--out lib/services/tides/fes2022-constituents.json]");
    return;
  }
  const rawPath = option("--raw");
  if (!rawPath) throw new Error("--raw is required");
  const out = option("--out") ?? "lib/services/tides/fes2022-constituents.json";
  const raw = JSON.parse(await readFile(rawPath, "utf8")) as RawExtraction;
  const catalog = buildCatalog(raw);
  await writeFile(out, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Wrote ${Object.keys(catalog.beaches).length} beaches to ${out}`);
}

if (require.main === module) main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
