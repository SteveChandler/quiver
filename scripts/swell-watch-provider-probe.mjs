// Read-only historical replay. This cannot accept, complete, evaluate, or qualify a study run.
// Run with: node --experimental-strip-types scripts/swell-watch-provider-probe.mjs
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { buildOpenMeteoSingleRunRequest, fetchOpenMeteoSingleRunReceipt, getSingleRunTupleDiagnostic } from "../lib/alerts/swell-watch/single-run-receipt.ts";

const sourcePointId = "f11ccd59-b778-4ea1-a8ff-88bffb447cd8";
const input = { latitude: 18.370386, longitude: -67.25763, runUtc: "2026-09-13T06:00Z", forecastDays: 7 };
const maximumBytes = 524_288;
const report = { mode: "read_only_historical_replay", qualification: "not_evaluated", sourcePointId,
  requestedRunUtc: input.runUtc, observedAt: new Date().toISOString(), providerRequests: 0,
  databaseCalls: 0, enqueued: 0, httpStatus: null, rawResponseSha256: null,
  parserOutcome: "not_run", diagnostic: null, errorCode: null };

try {
  const request = buildOpenMeteoSingleRunRequest(input);
  report.providerRequests += 1;
  const response = await fetch(request.url, { method: "GET", redirect: "error", credentials: "omit",
    cache: "no-store", signal: AbortSignal.timeout(20_000) });
  report.httpStatus = response.status;
  if (response.status !== 200 || !response.body) throw new Error("provider_http_unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) { await reader.cancel(); throw new Error("provider_response_too_large"); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  report.rawResponseSha256 = createHash("sha256").update(raw).digest("hex");
  try {
    await fetchOpenMeteoSingleRunReceipt(input, async () => ({ status: response.status, text: async () => raw }), sourcePointId);
    report.parserOutcome = "accepted_unqualified_receipt";
  } catch (error) {
    report.parserOutcome = "rejected";
    report.diagnostic = getSingleRunTupleDiagnostic(error);
    report.errorCode = report.diagnostic ? "single_runs_tuple_is_invalid" : "other_parser_rejection";
  }
} catch (error) {
  report.errorCode = error instanceof Error && ["provider_http_unavailable", "provider_response_too_large"].includes(error.message)
    ? error.message : "provider_transport_unavailable";
  process.exitCode = 1;
}
report.finishedAt = new Date().toISOString();
const output = JSON.stringify(report, null, 2);
// Never output the URL, raw body, arbitrary error text, environment, or credentials.
await writeFile("swell-watch-provider-probe.json", `${output}\n`, { mode: 0o600 });
console.log(output);
