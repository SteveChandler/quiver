import type { Json } from "@/types/database";

export const COUNTY_FEED_SOURCE_IDENTIFIER =
  "county-san-diego-dehq-sdbeachinfo" as const;
export const COUNTY_FEED_SOURCE_NAME = "County of San Diego DEHQ" as const;
export const COUNTY_FEED_SOURCE_URL = "https://www.sdbeachinfo.com/" as const;
export const COUNTY_FEED_BASE_URL =
  "https://cosdapps.sandiegocounty.gov/sdbeachinfo" as const;
export const COUNTY_FEED_API_VERSION = "o4RRlyKnDa4BnchjWGU0oQ" as const;
export const COUNTY_FEED_USER_AGENT =
  "Quiver Beach Advisories/1.0 (https://www.quiversurf.app/about)" as const;

export const COUNTY_ADVISORY_TYPES = [
  "advisory",
  "closure",
  "warning",
] as const;
export type CountyAdvisoryType = (typeof COUNTY_ADVISORY_TYPES)[number];

export const COUNTY_EVENT_TYPE_IDENTIFIERS = [1, 2, 3] as const;
export type CountyEventTypeIdentifier =
  (typeof COUNTY_EVENT_TYPE_IDENTIFIERS)[number];

export const COUNTY_MAX_STALENESS_MS = 2 * 60 * 60 * 1000;
export const COUNTY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const COUNTY_MIN_POLL_INTERVAL_MS = 30 * 60 * 1000;
export const COUNTY_MAX_CONSECUTIVE_FAILURES = 3;
export const COUNTY_BASE_BACKOFF_MS = 30 * 60 * 1000;
export const COUNTY_MAX_MATCH_DISTANCE_METERS = 500;

export interface CountyFeedManifest {
  versionToken: string;
  versionSequence: number;
}

export interface CountySiteNotification {
  latitude: number;
  longitude: number;
  sourceSiteIdentifier: string;
}

export interface CountyNotificationResponse {
  eventTypeIdentifier: CountyEventTypeIdentifier;
  advisoryType: CountyAdvisoryType;
  sites: CountySiteNotification[];
  rawPayload: Json;
  rawPayloadHash: string;
}

export interface CountyBeachCandidate {
  id: string;
  name: string;
  lat: number | null;
  lon: number | null;
}

export interface CountyAdvisoryRecord {
  sourceIdentifier: typeof COUNTY_FEED_SOURCE_IDENTIFIER;
  sourceName: typeof COUNTY_FEED_SOURCE_NAME;
  sourceUrl: typeof COUNTY_FEED_SOURCE_URL;
  sourceSiteIdentifier: string;
  advisoryType: CountyAdvisoryType;
  beachId: string | null;
  countyLatitude: number;
  countyLongitude: number;
  matchDistanceMeters: number | null;
  validFrom: string | null;
  validUntil: string | null;
  rawPayload: Json;
  rawPayloadHash: string;
  fetchedAt: string;
}

export interface CountyMatchSummary {
  records: CountyAdvisoryRecord[];
  totalSites: number;
  matchedSites: number;
  unmatchedSites: number;
  matchRate: number | null;
  countsByType: Record<CountyAdvisoryType, number>;
}

export interface CountyIngestState {
  source_identifier: string;
  accepted_version_token: string | null;
  accepted_version_sequence: number | null;
  observed_version_token: string | null;
  observed_version_sequence: number | null;
  consecutive_failures: number;
  circuit_open: boolean;
  next_attempt_at: string | null;
  last_request_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  updated_at: string | null;
}

export interface CountyIngestRun {
  id: string;
  source_identifier: string;
  status: "started" | "completed" | "failed";
  version_token: string;
  version_sequence: number;
  fetched_at: string;
  completed_at?: string | null;
  advisory_count?: number;
  closure_count?: number;
  warning_count?: number;
  unmatched_site_count?: number;
  match_rate?: number | null;
  error_kind?: string | null;
  error_message?: string | null;
}

export interface CountyFeedFetcher {
  fetchManifest(): Promise<CountyFeedManifest>;
  fetchNotifications(
    eventTypeIdentifier: CountyEventTypeIdentifier,
    manifest: CountyFeedManifest,
  ): Promise<CountyNotificationResponse>;
}

export interface CountyAdvisoryRepository {
  getState(): Promise<CountyIngestState | null>;
  saveState(state: CountyIngestState): Promise<void>;
  createRun(run: CountyIngestRun): Promise<void>;
  insertAdvisories(records: CountyAdvisoryRecord[], runId: string): Promise<void>;
  completeRun(
    runId: string,
    summary: Pick<CountyMatchSummary, "countsByType" | "unmatchedSites" | "matchRate"> & {
      recordCount: number;
      completedAt: string;
    },
  ): Promise<void>;
  failRun(runId: string, errorKind: string, errorMessage: string): Promise<void>;
  listBeaches(): Promise<CountyBeachCandidate[]>;
}

export type CountyIngestResult =
  | {
      status: "ok";
      runId: string;
      fetchedAt: string;
      versionSequence: number;
      versionToken: string;
      summary: CountyMatchSummary;
    }
  | {
      status: "skipped";
      reason: "backoff" | "circuit_open" | "poll_interval";
      nextAttemptAt: string | null;
    }
  | {
      status: "error";
      errorKind: "transient" | "version_mismatch" | "shape_change";
      error: string;
      circuitOpen: boolean;
      consecutiveFailures: number;
    };
