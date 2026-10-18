"use client";

import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

type WatchDevice = { id: string; name: string; partNumber: string; linkedAt: string; lastSeenAt: string | null };
type WatchProblem = { importId: string; startedAt: string | null; status: "failed" | "needs_beach"; reason: string | null };
type WatchDevicesData = { devices: WatchDevice[]; problems: WatchProblem[] };

export function useWatchDevices(isOwner: boolean): {
  data: WatchDevicesData | null;
  refresh: () => void;
} {
  const load = useCallback(async (): Promise<WatchDevicesData | null> => {
    const response = await fetch("/api/v1/watch/devices", { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (result?.success !== true || !Array.isArray(result.data?.devices) || !Array.isArray(result.data?.problems)) {
      throw new Error("Invalid watch devices response");
    }
    return result.data as WatchDevicesData;
  }, []);
  const { data, error, refetch } = useDataFetcher(load, { skip: !isOwner });
  return { data: isOwner && !error ? data : null, refresh: () => { void refetch(); } };
}
