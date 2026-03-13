"use client";

import { useCallback, useEffect, useRef } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getRecentConditionsReports } from "@/actions/conditions-report-actions";
import type { ConditionsReportData } from "@/types/conditions-report";
import { getVibeEmoji } from "@/types/conditions-report";

interface RecentReportsProps {
  beachId: string;
  /** When provided, the list will re-fetch to show the newly submitted report */
  refreshTrigger?: number;
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ReportCard({ report }: { report: ConditionsReportData }) {
  const vibeEmoji = getVibeEmoji(report.vibe);
  const vibeLabel = report.vibe.charAt(0).toUpperCase() + report.vibe.slice(1);

  return (
    <div
      data-testid="recent-report-card"
      className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm space-y-1"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-dark-grey">
          {report.user.full_name}
        </span>
        <span className="text-xs text-gray-400">{timeAgo(report.created_at)}</span>
      </div>
      <p className="text-sm text-gray-700">
        <span className="font-medium">{report.wave_size_range}</span>
        {" · "}
        <span>
          {vibeEmoji} {vibeLabel}
        </span>
      </p>
      {report.note && (
        <p className="text-xs text-gray-500 italic">{'"'}{report.note}{'"'}</p>
      )}
    </div>
  );
}

/**
 * RecentReports
 *
 * Displays up to 3 community conditions reports from the last 24 hours for a
 * given beach. The section is hidden entirely when there are no recent reports
 * (design decision: no empty state — it feels dead).
 *
 * Uses useDataFetcher + useCallback per the project's data-fetching pattern.
 */
export function RecentReports({ beachId, refreshTrigger = 0 }: RecentReportsProps) {
  const fetchFn = useCallback(async () => {
    const result = await getRecentConditionsReports(beachId);
    return result.success ? (result.data ?? []) : [];
  }, [beachId]);

  const {
    data: reports,
    loading,
    refetch,
  } = useDataFetcher<ConditionsReportData[]>(fetchFn);

  // Re-fetch when a new report is submitted by the current user
  const prevTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger !== prevTrigger.current) {
      prevTrigger.current = refreshTrigger;
      refetch();
    }
  }, [refreshTrigger, refetch]);

  // Loading: render nothing to avoid layout shift while we wait
  if (loading) return null;

  // No recent reports — hide the section entirely (design spec)
  if (!reports || reports.length === 0) return null;

  return (
    <section data-testid="recent-reports" className="mb-6 space-y-3">
      <h2 className="text-base font-semibold text-dark-grey">What Surfers Are Saying</h2>
      <div className="space-y-2">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}
