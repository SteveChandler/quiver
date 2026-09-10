import { execFileSync } from "node:child_process";
import proposed from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import { deriveAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const batch = "60b88e41-6cbf-415e-bafb-080a23eabcb5";
const now = "2026-09-10T00:00:00Z"; // offline historical replay inside the original 12-hour freshness window
const linkedWorktree = process.env.SWELL_WATCH_REPLAY_WORKDIR;
if (!linkedWorktree) throw new Error("SWELL_WATCH_REPLAY_WORKDIR is required");

function readScope(sourcePointId: string): { run: unknown; beach: Record<string, unknown>; latitude: number; longitude: number; rawHashes: string[] } {
  const sql = `select jsonb_build_object('run',read_swell_watch_attested_run('${batch}','${sourcePointId}'),'beach',jsonb_build_object('swell_window_center_deg',beach.swell_window_center_deg,'swell_window_halfwidth_deg',beach.swell_window_halfwidth_deg),'latitude',beach.lat,'longitude',beach.lon,'rawHashes',(select jsonb_agg(raw.raw_response_sha256 order by raw.raw_response_sha256) from swell_watch_provider_run_completed_batches completed join swell_watch_provider_run_revision_set_members member on member.revision_set_id=completed.revision_set_id join swell_watch_provider_run_batch_scopes scope on scope.id=member.scope_id join swell_watch_provider_run_revision_raw_responses raw on raw.revision_id=member.revision_id where completed.id='${batch}' and scope.source_point_id='${sourcePointId}')) as replay from beaches beach where beach.id='${sourcePointId}'`;
  const output = execFileSync("supabase", ["db", "query", "--linked", "--output-format", "json", sql], { cwd: linkedWorktree, encoding: "utf8" });
  return JSON.parse(output).rows[0].replay;
}

async function main(): Promise<void> {
  const outcomes = [];
  for (const scope of proposed.cohort) {
    const data = readScope(scope.sourcePointId);
    const result = await deriveAttestedSwellWatchRun({ providerBatchId: batch, sourcePointId: scope.sourcePointId,
      now, beach: data.beach as never, policy: proposed.policy as SwellWatchPolicy }, { rpc: async () => ({ data: data.run, error: null }) });
    outcomes.push({ sourcePointId: scope.sourcePointId, rawHashes: data.rawHashes, result: result.kind === "derived" ? "derived" : result.reason });
  }
  console.log(JSON.stringify({ batch, now, writes: 0, outcomes }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "offline replay failed"); process.exitCode = 1; });
