/**
 * Production use needs a fresh backup and Steven's explicit approval.
 * Roll back by re-running the tide refresh for affected beaches; deleted rows
 * are regenerable predictions.
 */
import { fetchTideBeachIds, fetchTideWindow, parseWindow, printTideReport, summarizeTideWindow, tideReportClient } from "./tide-forecast-integrity";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { from, to } = parseWindow(args);
  const client = tideReportClient();
  const { allIds, selectedIds } = await fetchTideBeachIds(client);
  const rows = await fetchTideWindow(client, from, to, allIds);
  const before = summarizeTideWindow(rows, selectedIds, from, to);
  printTideReport(before, from, to);
  const deleteRows = before.deleteRows;
  console.log(`Dry-run delete count: ${deleteRows.length}`);
  console.table(deleteRows.slice(0, 10).map(({ beach_id, ts, source, station_id }) => ({ beach_id, ts, source, station_id })));
  console.log("Expected after:");
  const discarded = new Set(deleteRows.map((row) => row.id));
  printTideReport(summarizeTideWindow(rows.filter((row) => !discarded.has(row.id)), selectedIds, from, to), from, to);

  if (!args.includes("--apply")) return;
  const confirm = args.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
  if (confirm !== String(deleteRows.length)) throw new Error(`--apply requires --confirm=${deleteRows.length}`);
  for (let offset = 0; offset < deleteRows.length; offset += 25) {
    for (const row of deleteRows.slice(offset, offset + 25)) {
      const { error } = await client.from("tide_forecasts").delete()
        .eq("beach_id", row.beach_id).eq("ts", row.ts).eq("source", row.source)
        .eq("created_at", row.created_at);
      if (error) throw new Error(`Delete ${row.beach_id} ${row.ts} ${row.source}: ${error.message}`);
    }
  }
  console.log("Actual after:");
  printTideReport(summarizeTideWindow(await fetchTideWindow(client, from, to, allIds), selectedIds, from, to), from, to);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
