export type TideDataSource = "noaa" | "open-meteo" | "user";

export type SessionTideStatus = "rising" | "falling" | "high" | "low";

export interface SessionTideSnapshot {
  tideHeightFt: number;
  tideStatus: SessionTideStatus;
  tideRateFtPerHr: number;
  source: TideDataSource;
}

interface RpcResult {
  data: unknown;
  error: { message?: string } | null;
}

interface TideSnapshotRpcClient {
  rpc: (
    functionName: "compute_session_tide_snapshot",
    args: { p_beach_id: string; p_arrival_time: string }
  ) => Promise<RpcResult>;
}

interface TideSnapshotRow {
  tide_height_ft?: number | string | null;
  tide_status?: string | null;
  tide_rate_ft_per_hr?: number | string | null;
  tide_data_source?: string | null;
}

const VALID_TIDE_STATUSES: Set<string> = new Set([
  "rising",
  "falling",
  "high",
  "low",
]);

const VALID_TIDE_SOURCES: Set<string> = new Set(["noaa", "open-meteo", "user"]);

function parseNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSnapshotRow(row: TideSnapshotRow): SessionTideSnapshot | null {
  const tideHeightFt = parseNumber(row.tide_height_ft);
  const tideRateFtPerHr = parseNumber(row.tide_rate_ft_per_hr);
  const tideStatus = row.tide_status?.toLowerCase() ?? "";
  const source = row.tide_data_source ?? "";

  if (tideHeightFt === null || tideRateFtPerHr === null) return null;
  if (!VALID_TIDE_STATUSES.has(tideStatus)) return null;
  if (!VALID_TIDE_SOURCES.has(source)) return null;

  return {
    tideHeightFt,
    tideStatus: tideStatus as SessionTideStatus,
    tideRateFtPerHr,
    source: source as TideDataSource,
  };
}

export async function fetchSessionTideSnapshot(
  client: TideSnapshotRpcClient,
  beachId: string,
  arrivalTimeIso: string
): Promise<SessionTideSnapshot | null> {
  const { data, error } = await client.rpc("compute_session_tide_snapshot", {
    p_beach_id: beachId,
    p_arrival_time: arrivalTimeIso,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to compute session tide snapshot");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  return normalizeSnapshotRow(row as TideSnapshotRow);
}

export function formatSessionTideSnapshot(
  snapshot: Pick<
    SessionTideSnapshot,
    "tideHeightFt" | "tideStatus" | "tideRateFtPerHr"
  >
): string {
  const height = snapshot.tideHeightFt.toFixed(1);
  const rate = Math.abs(snapshot.tideRateFtPerHr).toFixed(1);
  return `${height} ft · ${snapshot.tideStatus} · ${rate} ft/hr`;
}
