"use client";

import { useCallback } from "react";
import { z } from "zod";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { createClient } from "@/lib/supabase/client";
import { formatBeachDateTime } from "@/lib/utils/date-time";

const riskSchema = z.object({
  beach_id: z.string(),
  valid_date: z.string(),
  risk_level: z.enum(["low", "moderate", "high"]),
  source: z.enum(["srf", "alert", "derived"]),
  fetched_at: z.string().refine((value) => Number.isFinite(Date.parse(value))),
});

const SOURCE_LABELS = {
  srf: "NWS Surf Zone Forecast",
  alert: "NWS Beach Hazards Statement",
  derived: "Estimated from swell & tide",
};

export function RipCurrentWarning({ beachId, localDate, timezone }: {
  beachId: string;
  localDate: string;
  timezone: string;
}) {
  const fetchRisk = useCallback(async (): Promise<z.infer<typeof riskSchema> | null> => {
    const { data, error } = await createClient()
      .from("rip_current_risks")
      .select("beach_id, valid_date, risk_level, source, fetched_at")
      .eq("beach_id", beachId)
      .eq("valid_date", localDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const risk = riskSchema.parse(data);
    if (risk.beach_id !== beachId || risk.valid_date !== localDate) {
      throw new Error("Rip-current report does not match the displayed forecast");
    }
    return risk;
  }, [beachId, localDate]);
  const { data: risk, loading, error } = useDataFetcher(fetchRisk, {
    cacheKey: `rip-current-risk:${beachId}:${localDate}`,
  });

  if (loading) return <p role="status" className="mt-4 text-sm">Checking rip currents…</p>;
  if (risk?.risk_level === "low") return null;

  return (
    <aside aria-label="Rip-current conditions" className="mt-4 border-l-4 border-[#B47A0F] bg-[#F7E7BE] px-3 py-2 text-sm leading-5 text-[#11100D]">
      <p className="font-bold">
        {risk
          ? `${risk.risk_level === "high" ? "High" : "Moderate"} rip-current risk`
          : error ? "Rip-current update unavailable" : "Rip-current report unavailable"}
      </p>
      <p>Check with a lifeguard before entering the water.</p>
      {risk && (
        <p className="mt-1 font-mono text-xs">
          {SOURCE_LABELS[risk.source]} · Valid {localDate} · Source updated <time dateTime={risk.fetched_at}>{formatBeachDateTime(risk.fetched_at, timezone, "EEE, MMM d")} {formatBeachDateTime(risk.fetched_at, timezone, "h:mm a")}</time> {timezone}
        </p>
      )}
    </aside>
  );
}
