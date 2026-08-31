#!/usr/bin/env tsx
/**
 * Read-only Track B session-acquisition funnel report.
 *
 * Usage:
 *   yarn tsx scripts/session-acquisition-funnel-report.ts --days 30
 *   yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --output-json /tmp/quiver-session-acquisition-funnel-report.json
 *   yarn tsx scripts/session-acquisition-funnel-report.ts --start 2026-06-01 --end 2026-07-01
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../types/database.generated";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const PAGE_SIZE = 1000;
const MS_PER_DAY = 86_400_000;
const DEFAULT_MIN_RATED_SESSIONS = 100;
const DEFAULT_MIN_RATED_SESSION_USERS = 25;
const DEFAULT_MIN_FIVE_RATED_SESSION_USERS = 25;
const DEFAULT_MIN_FACE_HEIGHT_TRUTH_SESSIONS = 75;
const DEFAULT_MIN_BEACH_SELECTED_COVERAGE = 0.8;
const DEFAULT_MIN_CONDITIONS_SET_COVERAGE = 0.8;
const DEFAULT_MIN_SUBMIT_EVENT_COVERAGE = 0.8;
const DEFAULT_MIN_RECENT_BUILD_METADATA_COVERAGE = 0.8;
const DEFAULT_RECENT_TELEMETRY_DAYS = 7;
const SESSION_ACQUISITION_REPORT_SCHEMA_VERSION = 3;
const MAX_GENERATED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_APP_VERSION_LENGTH = 64;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UNSAFE_IDENTIFIER_EVIDENCE_PATTERN =
  /\b(?:user_id|flow_id|event_id|session_id)\s*[:=]\s*\S+/i;
const UNSAFE_IDENTIFIER_KEYS = new Set([
  "user_id",
  "userId",
  "flow_id",
  "flowId",
  "event_id",
  "eventId",
  "session_id",
  "sessionId",
]);
const NATIVE_PLATFORM_LABELS = new Set(["native-ios", "native-android"]);
const DEVICE_TYPE_LABELS = new Set(["mobile", "desktop", "tablet"]);
const DEVICE_OS_LABELS = new Set([
  "iOS",
  "Android",
  "Windows",
  "macOS",
  "Linux",
  "unknown",
]);
const APP_VERSION_PATTERN =
  /^\d{1,4}(?:\.\d{1,4}){1,3}(?:[-+][0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const APP_BUILD_PATTERN = /^\d{1,15}$/;
const SESSION_ACQUISITION_REPORT_KEYS = [
  "reportSchemaVersion",
  "generatedAt",
  "start",
  "end",
  "days",
  "eventRows",
  "sessionRows",
  "lifetimeSessionRows",
  "profileRows",
  "excludedEventRows",
  "excludedSessionRows",
  "funnelSteps",
  "canonicalFunnel",
  "validationBranch",
  "firstSessionTelemetryCoverage",
  "eventsByType",
  "eventsByPlatform",
  "sessionsBySource",
  "savedSessionUsers",
  "ratedSessionUsers",
  "faceHeightTruthUsers",
  "ratedFaceHeightTruthUsers",
  "savedSessions",
  "ratedSessions",
  "faceHeightTruthSessions",
  "ratedFaceHeightTruthSessions",
  "abandonedActors",
  "validationFailedActors",
  "activation",
  "onboarding",
  "readiness",
  "telemetryCoverage",
  "telemetryCoverageByPlatform",
  "recentTelemetry",
  "validationFailuresByCode",
  "gaps",
] as const;
const CANONICAL_FUNNEL_KEYS = [
  "grain",
  "ordering",
  "steps",
  "joinCoverage",
] as const;
const CANONICAL_STEP_KEYS = [
  "key",
  "label",
  "users",
  "flows",
  "pctOfStart",
  "pctOfPrevious",
] as const;
const CANONICAL_JOIN_COVERAGE_KEYS = [
  "funnelEventRowsMissingUserId",
  "funnelEventsMissingFlowId",
  "submitEventsMissingSessionId",
  "firstSessionMarkersMissingSessionId",
  "firstSessionMarkersMissingUserId",
  "funnelEventsWithUnusableClientStageAt",
  "stableIdConflictGroups",
  "submitFlowsWithoutWindowSession",
  "submitFlowsWithSessionOwnerMismatch",
  "submitFlowsWithIneligibleSession",
] as const;
const VALIDATION_BRANCH_KEYS = [
  "affectedUsers",
  "affectedFlows",
  "pctOfFormViewUsers",
  "recoveredUsers",
  "recoveredFlows",
  "recoveryRate",
] as const;
const FIRST_SESSION_TELEMETRY_KEYS = [
  "persistedFirstSessionUsers",
  "markerUsers",
  "coverage",
] as const;
const CANONICAL_STEP_ORDER = [
  "start",
  "form_view",
  "submit",
  "persisted_session",
] as const;

export const SESSION_ACQUISITION_EVENT_TYPES = [
  "session_log_start",
  "session_log_form_view",
  "session_log_beach_selected",
  "session_log_conditions_set",
  "session_log_rating_set",
  "session_log_validation_failed",
  "session_log_abandon",
  "session_log_submit",
  "first_session_logged",
] as const;

export const SESSION_FORM_VALIDATION_ERROR_CODES = [
  "beach_required",
  "rating_required",
  "wave_height_required",
  "rating_out_of_range",
  "crowd_level_out_of_range",
  "duration_out_of_range",
  "future_date",
] as const;

type SessionAcquisitionEventType =
  (typeof SESSION_ACQUISITION_EVENT_TYPES)[number];

type SessionFormValidationErrorCode =
  (typeof SESSION_FORM_VALIDATION_ERROR_CODES)[number];
type SessionAcquisitionReadinessFindingCode =
  | "rated_sessions_floor"
  | "rated_session_users_floor"
  | "five_rated_session_users_floor"
  | "rated_face_height_truth_sessions_floor"
  | "beach_selected_coverage_floor"
  | "conditions_set_coverage_floor"
  | "submit_event_coverage_floor"
  | "recent_beach_selected_coverage_floor"
  | "recent_conditions_set_coverage_floor"
  | "recent_submit_event_coverage_floor"
  | "recent_build_metadata_coverage_floor"
  | "expected_recent_client_build_missing";

const SESSION_FORM_VALIDATION_ERROR_CODE_SET = new Set<string>(
  SESSION_FORM_VALIDATION_ERROR_CODES
);

export interface CliOptions {
  start: string;
  end: string;
  minRatedSessions: number;
  minRatedSessionUsers: number;
  minFiveRatedSessionUsers: number;
  minFaceHeightTruthSessions: number;
  minBeachSelectedCoverage: number;
  minConditionsSetCoverage: number;
  minSubmitEventCoverage: number;
  minRecentBuildMetadataCoverage: number;
  expectedRecentClientBuilds: string[];
  recentTelemetryDays: number;
  failOnNotReady: boolean;
  outputJsonPath: string | null;
  validateOutputJsonPath: string | null;
  maxReportAgeHours: number | null;
}

export interface SessionAcquisitionReadinessCriteria {
  minRatedSessions: number;
  minRatedSessionUsers: number;
  minFiveRatedSessionUsers: number;
  minFaceHeightTruthSessions: number;
  minBeachSelectedCoverage: number;
  minConditionsSetCoverage: number;
  minSubmitEventCoverage: number;
  minRecentBuildMetadataCoverage: number;
  expectedRecentClientBuilds?: string[];
}

export interface SessionAcquisitionEventRow {
  user_id: string | null;
  session_id: string | null;
  event_type: string;
  created_at: string;
  metadata: unknown;
  bot_flagged: boolean | null;
}

export interface SessionAcquisitionSessionRow {
  id: string;
  user_id: string;
  created_at: string;
  arrival_time: string;
  status: string | null;
  source: string | null;
  rating: number | null;
  wave_height_ft: number | null;
  deleted_at: string | null;
}

export interface SessionAcquisitionProfileRow {
  id: string;
  created_at: string;
  deleted_at: string | null;
  onboarding_completed_at: string | null;
  experience_level: string | null;
  activity_level: string | null;
  home_beach_id: string | null;
  surf_styles: string[] | null;
  preferred_session_time: string | null;
  timezone: string | null;
  is_mock: boolean;
  analytics_is_real_user: boolean;
  is_system_account: boolean | null;
  analytics_exclusion_reason: string | null;
}

export interface FunnelStepMetric {
  key: string;
  label: string;
  actors: number;
  actorsWithStart: number;
  pctOfStart: number | null;
  pctOfPrevious: number | null;
}

export type CanonicalSessionFunnelStepKey =
  | "start"
  | "form_view"
  | "submit"
  | "persisted_session";

export interface CanonicalSessionFunnelStep {
  key: CanonicalSessionFunnelStepKey;
  label: string;
  users: number;
  flows: number;
  pctOfStart: number | null;
  pctOfPrevious: number | null;
}

export interface CanonicalSessionJoinCoverage {
  funnelEventRowsMissingUserId: number;
  funnelEventsMissingFlowId: number;
  submitEventsMissingSessionId: number;
  firstSessionMarkersMissingSessionId: number;
  firstSessionMarkersMissingUserId: number;
  funnelEventsWithUnusableClientStageAt: number;
  stableIdConflictGroups: number;
  submitFlowsWithoutWindowSession: number;
  submitFlowsWithSessionOwnerMismatch: number;
  submitFlowsWithIneligibleSession: number;
}

export interface CanonicalSessionFunnel {
  grain: "unique_user";
  ordering: "metadata.client_stage_at";
  steps: CanonicalSessionFunnelStep[];
  joinCoverage: CanonicalSessionJoinCoverage;
}

export interface SessionValidationBranch {
  affectedUsers: number;
  affectedFlows: number;
  pctOfFormViewUsers: number | null;
  recoveredUsers: number;
  recoveredFlows: number;
  recoveryRate: number | null;
}

export interface FirstSessionTelemetryCoverage {
  persistedFirstSessionUsers: number;
  markerUsers: number;
  coverage: number | null;
}

export interface ActivationSummary {
  windowUsersWithRatedSession: number;
  windowUsersWithThreeRatedSessions: number;
  windowUsersWithFiveRatedSessions: number;
  lifetimeScopedUsersWithFiveRatedSessions: number;
  medianDaysToFifthRating: number | null;
  p75DaysToFifthRating: number | null;
}

export interface OnboardingSummary {
  newProfiles: number;
  completedOnboarding: number;
  withHomeBeach: number;
  withExperienceLevel: number;
  withActivityLevel: number;
  withSurfStyles: number;
  withPreferredSessionTime: number;
  withTimezone: number;
}

export interface SessionAcquisitionReport {
  reportSchemaVersion: 3;
  generatedAt: string;
  start: string;
  end: string;
  days: number;
  eventRows: number;
  sessionRows: number;
  lifetimeSessionRows: number;
  profileRows: number;
  excludedEventRows: number;
  excludedSessionRows: number;
  funnelSteps: FunnelStepMetric[];
  canonicalFunnel: CanonicalSessionFunnel;
  validationBranch: SessionValidationBranch;
  firstSessionTelemetryCoverage: FirstSessionTelemetryCoverage;
  eventsByType: Record<string, number>;
  eventsByPlatform: Record<string, number>;
  sessionsBySource: Record<string, number>;
  savedSessionUsers: number;
  ratedSessionUsers: number;
  faceHeightTruthUsers: number;
  ratedFaceHeightTruthUsers: number;
  savedSessions: number;
  ratedSessions: number;
  faceHeightTruthSessions: number;
  ratedFaceHeightTruthSessions: number;
  abandonedActors: number;
  validationFailedActors: number;
  activation: ActivationSummary;
  onboarding: OnboardingSummary;
  readiness: SessionAcquisitionReadiness;
  telemetryCoverage: {
    beachSelectedOfStart: number | null;
    conditionsSetOfStart: number | null;
    submitEventOfSavedSessionUsers: number | null;
  };
  telemetryCoverageByPlatform: SessionTelemetryPlatformCoverage[];
  recentTelemetry: SessionRecentTelemetryWindow;
  validationFailuresByCode: SessionValidationFailureMetric[];
  gaps: string[];
}

export interface SessionAcquisitionReportValidationResult {
  ok: boolean;
  blockers: string[];
}

export interface SessionAcquisitionReadiness {
  verdict: "ready" | "not-ready";
  readyForPersonalizationEvaluation: boolean;
  criteria: SessionAcquisitionReadinessCriteria;
  observed: {
    ratedSessions: number;
    ratedSessionUsers: number;
    lifetimeScopedUsersWithFiveRatedSessions: number;
    faceHeightTruthSessions: number;
    ratedFaceHeightTruthSessions: number;
    beachSelectedCoverage: number | null;
    conditionsSetCoverage: number | null;
    submitEventCoverage: number | null;
    recentBeachSelectedCoverage: number | null;
    recentConditionsSetCoverage: number | null;
    recentSubmitEventCoverage: number | null;
    recentBuildMetadataCoverage: number | null;
    expectedRecentClientBuildStartActors: Record<string, number>;
  };
  findings: string[];
  findingCodes: SessionAcquisitionReadinessFindingCode[];
}

interface SessionAcquisitionReadinessFinding {
  code: SessionAcquisitionReadinessFindingCode;
  message: string;
}

export interface SessionTelemetryPlatformCoverage {
  platform: string;
  startActors: number;
  formViewActors: number;
  formViewActorsWithStart: number;
  formViewOfStart: number | null;
  beachSelectedActors: number;
  beachSelectedActorsWithStart: number;
  beachSelectedOfStart: number | null;
  conditionsSetActors: number;
  conditionsSetActorsWithStart: number;
  conditionsSetOfStart: number | null;
  submitEventActors: number;
  submitActorsWithStart: number;
  submitEventOfStart: number | null;
}

export interface SessionTelemetryClientBuildCoverage {
  clientBuild: string;
  hasVersionMetadata: boolean;
  hasBuildMetadata: boolean;
  startActors: number;
  formViewActors: number;
  formViewActorsWithStart: number;
  formViewOfStart: number | null;
  beachSelectedActors: number;
  beachSelectedActorsWithStart: number;
  beachSelectedOfStart: number | null;
  conditionsSetActors: number;
  conditionsSetActorsWithStart: number;
  conditionsSetOfStart: number | null;
  submitEventActors: number;
  submitActorsWithStart: number;
  submitEventOfStart: number | null;
}

export interface SessionValidationFailureMetric {
  code: string;
  events: number;
  actors: number;
  platforms: Record<string, number>;
}

export interface SessionRecentTelemetryWindow {
  start: string;
  end: string;
  days: number;
  eventRows: number;
  startActors: number;
  startActorsWithoutBuildMetadata: number;
  formViewActors: number;
  formViewActorsWithStart: number;
  formViewOfStart: number | null;
  beachSelectedActors: number;
  beachSelectedActorsWithStart: number;
  beachSelectedOfStart: number | null;
  conditionsSetActors: number;
  conditionsSetActorsWithStart: number;
  conditionsSetOfStart: number | null;
  submitEventActors: number;
  submitActorsWithStart: number;
  submitEventOfStart: number | null;
  telemetryCoverageByPlatform: SessionTelemetryPlatformCoverage[];
  telemetryCoverageByClientBuild: SessionTelemetryClientBuildCoverage[];
  validationFailuresByCode: SessionValidationFailureMetric[];
}

export function sessionAcquisitionReadinessCriteriaFromOptions(
  options: Pick<
    CliOptions,
    | "minRatedSessions"
    | "minRatedSessionUsers"
    | "minFiveRatedSessionUsers"
    | "minFaceHeightTruthSessions"
    | "minBeachSelectedCoverage"
    | "minConditionsSetCoverage"
    | "minSubmitEventCoverage"
    | "minRecentBuildMetadataCoverage"
    | "expectedRecentClientBuilds"
  >
): SessionAcquisitionReadinessCriteria {
  return {
    minRatedSessions: options.minRatedSessions,
    minRatedSessionUsers: options.minRatedSessionUsers,
    minFiveRatedSessionUsers: options.minFiveRatedSessionUsers,
    minFaceHeightTruthSessions: options.minFaceHeightTruthSessions,
    minBeachSelectedCoverage: options.minBeachSelectedCoverage,
    minConditionsSetCoverage: options.minConditionsSetCoverage,
    minSubmitEventCoverage: options.minSubmitEventCoverage,
    minRecentBuildMetadataCoverage: options.minRecentBuildMetadataCoverage,
    expectedRecentClientBuilds: options.expectedRecentClientBuilds,
  };
}

type AdminClient = SupabaseClient<Database>;
type PlatformActorMap = Map<string, Map<string, Set<string>>>;
type ClientBuildActorMap = Map<string, Map<string, Set<string>>>;

export interface SessionAcquisitionSourceRows {
  events: SessionAcquisitionEventRow[];
  windowSessions: SessionAcquisitionSessionRow[];
  lifetimeSessions: SessionAcquisitionSessionRow[];
  profiles: SessionAcquisitionProfileRow[];
}

export function parseCliArgs(argv: string[], now: Date = new Date()): CliOptions {
  let start: string | null = null;
  let end = now.toISOString();
  let days = 30;
  let minRatedSessions = DEFAULT_MIN_RATED_SESSIONS;
  let minRatedSessionUsers = DEFAULT_MIN_RATED_SESSION_USERS;
  let minFiveRatedSessionUsers = DEFAULT_MIN_FIVE_RATED_SESSION_USERS;
  let minFaceHeightTruthSessions = DEFAULT_MIN_FACE_HEIGHT_TRUTH_SESSIONS;
  let minBeachSelectedCoverage = DEFAULT_MIN_BEACH_SELECTED_COVERAGE;
  let minConditionsSetCoverage = DEFAULT_MIN_CONDITIONS_SET_COVERAGE;
  let minSubmitEventCoverage = DEFAULT_MIN_SUBMIT_EVENT_COVERAGE;
  let minRecentBuildMetadataCoverage =
    DEFAULT_MIN_RECENT_BUILD_METADATA_COVERAGE;
  const expectedRecentClientBuilds: string[] = [];
  let recentTelemetryDays = DEFAULT_RECENT_TELEMETRY_DAYS;
  let failOnNotReady = false;
  let outputJsonPath: string | null = null;
  let validateOutputJsonPath: string | null = null;
  let maxReportAgeHours: number | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--start") {
      const value = readFlagValue(next, "--start");
      start = parseDateFlag(value, "--start");
      i++;
      continue;
    }

    if (arg.startsWith("--start=")) {
      start = parseDateFlag(
        readFlagValue(arg.split("=")[1], "--start"),
        "--start"
      );
      continue;
    }

    if (arg === "--end") {
      const value = readFlagValue(next, "--end");
      end = parseDateFlag(value, "--end");
      i++;
      continue;
    }

    if (arg.startsWith("--end=")) {
      end = parseDateFlag(
        readFlagValue(arg.split("=")[1], "--end"),
        "--end"
      );
      continue;
    }

    if (arg === "--days") {
      const value = readFlagValue(next, "--days");
      days = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--days=")) {
      days = Number(readFlagValue(arg.split("=")[1], "--days"));
      continue;
    }

    if (arg === "--min-rated-sessions") {
      const value = readFlagValue(next, "--min-rated-sessions");
      minRatedSessions = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-rated-sessions=")) {
      minRatedSessions = Number(
        readFlagValue(arg.split("=")[1], "--min-rated-sessions")
      );
      continue;
    }

    if (arg === "--min-rated-session-users") {
      const value = readFlagValue(next, "--min-rated-session-users");
      minRatedSessionUsers = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-rated-session-users=")) {
      minRatedSessionUsers = Number(
        readFlagValue(arg.split("=")[1], "--min-rated-session-users")
      );
      continue;
    }

    if (arg === "--min-five-rated-session-users") {
      const value = readFlagValue(next, "--min-five-rated-session-users");
      minFiveRatedSessionUsers = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-five-rated-session-users=")) {
      minFiveRatedSessionUsers = Number(
        readFlagValue(arg.split("=")[1], "--min-five-rated-session-users")
      );
      continue;
    }

    if (arg === "--min-face-height-truth-sessions") {
      const value = readFlagValue(next, "--min-face-height-truth-sessions");
      minFaceHeightTruthSessions = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-face-height-truth-sessions=")) {
      minFaceHeightTruthSessions = Number(
        readFlagValue(arg.split("=")[1], "--min-face-height-truth-sessions")
      );
      continue;
    }

    if (arg === "--min-beach-selected-coverage") {
      const value = readFlagValue(next, "--min-beach-selected-coverage");
      minBeachSelectedCoverage = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-beach-selected-coverage=")) {
      minBeachSelectedCoverage = Number(
        readFlagValue(arg.split("=")[1], "--min-beach-selected-coverage")
      );
      continue;
    }

    if (arg === "--min-submit-event-coverage") {
      const value = readFlagValue(next, "--min-submit-event-coverage");
      minSubmitEventCoverage = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-submit-event-coverage=")) {
      minSubmitEventCoverage = Number(
        readFlagValue(arg.split("=")[1], "--min-submit-event-coverage")
      );
      continue;
    }

    if (arg === "--min-conditions-set-coverage") {
      const value = readFlagValue(next, "--min-conditions-set-coverage");
      minConditionsSetCoverage = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-conditions-set-coverage=")) {
      minConditionsSetCoverage = Number(
        readFlagValue(arg.split("=")[1], "--min-conditions-set-coverage")
      );
      continue;
    }

    if (arg === "--min-recent-build-metadata-coverage") {
      const value = readFlagValue(next, "--min-recent-build-metadata-coverage");
      minRecentBuildMetadataCoverage = Number(value);
      i++;
      continue;
    }

    if (arg.startsWith("--min-recent-build-metadata-coverage=")) {
      minRecentBuildMetadataCoverage = Number(
        readFlagValue(
          arg.split("=")[1],
          "--min-recent-build-metadata-coverage"
        )
      );
      continue;
    }

    if (arg === "--recent-telemetry-days") {
      const value = readFlagValue(next, "--recent-telemetry-days");
      recentTelemetryDays = Number(value);
      i++;
      continue;
    }

    if (arg === "--expect-recent-client-build") {
      const value = readFlagValue(next, "--expect-recent-client-build");
      expectedRecentClientBuilds.push(parseExpectedClientBuild(value));
      i++;
      continue;
    }

    if (arg.startsWith("--expect-recent-client-build=")) {
      expectedRecentClientBuilds.push(
        parseExpectedClientBuild(
          readFlagValue(
            arg.split("=")[1],
            "--expect-recent-client-build"
          )
        )
      );
      continue;
    }

    if (arg.startsWith("--recent-telemetry-days=")) {
      recentTelemetryDays = Number(
        readFlagValue(arg.split("=")[1], "--recent-telemetry-days")
      );
      continue;
    }

    if (arg === "--fail-on-not-ready") {
      failOnNotReady = true;
      continue;
    }

    if (arg === "--output-json") {
      outputJsonPath = readFlagValue(next, "--output-json");
      i++;
      continue;
    }

    if (arg.startsWith("--output-json=")) {
      outputJsonPath = readFlagValue(arg.split("=")[1], "--output-json");
      continue;
    }

    if (arg === "--validate-output-json") {
      validateOutputJsonPath = readFlagValue(next, "--validate-output-json");
      i++;
      continue;
    }

    if (arg.startsWith("--validate-output-json=")) {
      validateOutputJsonPath = readFlagValue(
        arg.split("=")[1],
        "--validate-output-json"
      );
      continue;
    }

    if (arg === "--max-report-age-hours") {
      maxReportAgeHours = Number(
        readFlagValue(next, "--max-report-age-hours")
      );
      i++;
      continue;
    }

    if (arg.startsWith("--max-report-age-hours=")) {
      maxReportAgeHours = Number(
        readFlagValue(arg.split("=")[1], "--max-report-age-hours")
      );
      continue;
    }

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}.`);
  }

  if (!isPositiveInteger(days)) {
    throw new Error("--days must be a positive integer");
  }
  if (!isNonNegativeInteger(minRatedSessions)) {
    throw new Error("--min-rated-sessions must be a non-negative integer");
  }
  if (!isNonNegativeInteger(minRatedSessionUsers)) {
    throw new Error("--min-rated-session-users must be a non-negative integer");
  }
  if (!isNonNegativeInteger(minFiveRatedSessionUsers)) {
    throw new Error(
      "--min-five-rated-session-users must be a non-negative integer"
    );
  }
  if (!isNonNegativeInteger(minFaceHeightTruthSessions)) {
    throw new Error(
      "--min-face-height-truth-sessions must be a non-negative integer"
    );
  }
  if (
    !Number.isFinite(minBeachSelectedCoverage) ||
    minBeachSelectedCoverage < 0 ||
    minBeachSelectedCoverage > 1
  ) {
    throw new Error("--min-beach-selected-coverage must be between 0 and 1");
  }
  if (
    !Number.isFinite(minConditionsSetCoverage) ||
    minConditionsSetCoverage < 0 ||
    minConditionsSetCoverage > 1
  ) {
    throw new Error("--min-conditions-set-coverage must be between 0 and 1");
  }
  if (
    !Number.isFinite(minSubmitEventCoverage) ||
    minSubmitEventCoverage < 0 ||
    minSubmitEventCoverage > 1
  ) {
    throw new Error("--min-submit-event-coverage must be between 0 and 1");
  }
  if (
    !Number.isFinite(minRecentBuildMetadataCoverage) ||
    minRecentBuildMetadataCoverage < 0 ||
    minRecentBuildMetadataCoverage > 1
  ) {
    throw new Error(
      "--min-recent-build-metadata-coverage must be between 0 and 1"
    );
  }
  if (!isPositiveInteger(recentTelemetryDays)) {
    throw new Error("--recent-telemetry-days must be a positive integer");
  }
  if (
    maxReportAgeHours !== null &&
    !isPositiveInteger(maxReportAgeHours)
  ) {
    throw new Error("--max-report-age-hours must be a positive integer");
  }
  if (outputJsonPath && validateOutputJsonPath) {
    throw new Error(
      "--validate-output-json cannot be combined with --output-json."
    );
  }
  if (maxReportAgeHours !== null && !validateOutputJsonPath) {
    throw new Error(
      "--max-report-age-hours requires --validate-output-json."
    );
  }

  if (!start) {
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - days);
    start = startDate.toISOString();
  }

  assertMeasurementWindow(start, end);

  return {
    start,
    end,
    minRatedSessions,
    minRatedSessionUsers,
    minFiveRatedSessionUsers,
    minFaceHeightTruthSessions,
    minBeachSelectedCoverage,
    minConditionsSetCoverage,
    minSubmitEventCoverage,
    minRecentBuildMetadataCoverage,
    expectedRecentClientBuilds: Array.from(new Set(expectedRecentClientBuilds)),
    recentTelemetryDays,
    failOnNotReady,
    outputJsonPath,
    validateOutputJsonPath,
    maxReportAgeHours,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function readFlagValue(value: string | undefined, flagName: string): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flagName} requires a value.`);
  }
  return value;
}

function parseDateFlag(value: string, flagName: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid date.`);
  }
  return parsed.toISOString();
}

function parseExpectedClientBuild(value: string): string {
  const parts = value.includes(",")
    ? value.split(",")
    : value.split(" / ");
  if (parts.length !== 3 || parts.some((part) => part.trim().length === 0)) {
    throw new Error(
      "--expect-recent-client-build must be platform,version,build or \"platform / version / build\"."
    );
  }
  return parts.map((part) => part.trim()).join(" / ");
}

function assertMeasurementWindow(start: string, end: string): void {
  if (new Date(start).getTime() >= new Date(end).getTime()) {
    throw new Error("Measurement start must be before end.");
  }
}

export function computeSessionAcquisitionReport(input: {
  start: string;
  end: string;
  events: SessionAcquisitionEventRow[];
  windowSessions: SessionAcquisitionSessionRow[];
  lifetimeSessions: SessionAcquisitionSessionRow[];
  profiles: SessionAcquisitionProfileRow[];
  readinessCriteria?: SessionAcquisitionReadinessCriteria;
  recentTelemetryDays?: number;
  generatedAt?: string;
}): SessionAcquisitionReport {
  const profileById = new Map<string, SessionAcquisitionProfileRow>(
    input.profiles.map((profile) => [profile.id, profile])
  );

  const events = input.events.filter((event) => {
    if (event.bot_flagged === true) return false;
    if (!event.user_id) return true;
    return isRealProfile(profileById.get(event.user_id));
  });
  const windowSessions = input.windowSessions.filter((session) =>
    isIncludedSession(session, profileById)
  );
  const lifetimeSessions = input.lifetimeSessions.filter((session) =>
    isIncludedSession(session, profileById)
  );
  const realProfiles = input.profiles.filter(
    (profile) =>
      isRealProfile(profile) &&
      timestampInRange(profile.created_at, input.start, input.end)
  );

  const eventActorsByType = buildEventActorsByType(events);
  const eventActorsByTypeAndPlatform = buildEventActorsByTypeAndPlatform(events);
  const completedWindowSessions = windowSessions.filter(isCompletedSession);
  const ratedWindowSessions = completedWindowSessions.filter(hasRating);
  const faceHeightTruthSessions = completedWindowSessions.filter(hasFaceHeight);
  const ratedFaceHeightTruthSessions = ratedWindowSessions.filter(hasFaceHeight);

  const startActors = eventActorsByType.get("session_log_start") ?? new Set();
  const beachSelectedActors =
    eventActorsByType.get("session_log_beach_selected") ?? new Set();
  const conditionsSetActors =
    eventActorsByType.get("session_log_conditions_set") ?? new Set();
  const submitEventActors =
    eventActorsByType.get("session_log_submit") ?? new Set();
  const savedSessionActors = actorSetFromSessions(completedWindowSessions);
  const ratedSessionActors = actorSetFromSessions(ratedWindowSessions);
  const faceHeightTruthActors = actorSetFromSessions(faceHeightTruthSessions);
  const ratedFaceHeightTruthActors = actorSetFromSessions(
    ratedFaceHeightTruthSessions
  );
  const validationFailedActors =
    eventActorsByType.get("session_log_validation_failed") ?? new Set();
  const abandonedActors = eventActorsByType.get("session_log_abandon") ?? new Set();
  const validationFailuresByCode = buildValidationFailuresByCode(
    events.filter((event) => event.event_type === "session_log_validation_failed")
  );

  const funnelInputs: Array<{
    key: string;
    label: string;
    actors: Set<string>;
  }> = [
    {
      key: "form_started",
      label: "Form started",
      actors: startActors,
    },
    {
      key: "beach_selected_event",
      label: "Beach selected event",
      actors: beachSelectedActors,
    },
    {
      key: "conditions_set_event",
      label: "Conditions set event",
      actors: conditionsSetActors,
    },
    {
      key: "rating_set_event",
      label: "Rating set event",
      actors: eventActorsByType.get("session_log_rating_set") ?? new Set(),
    },
    {
      key: "stored_submit_event",
      label: "Stored submit event",
      actors: submitEventActors,
    },
    {
      key: "saved_completed_session",
      label: "Saved completed session",
      actors: savedSessionActors,
    },
    {
      key: "rated_completed_session",
      label: "Rated completed session",
      actors: ratedSessionActors,
    },
    {
      key: "rated_face_height_truth_session",
      label: "Rated face-height truth session",
      actors: ratedFaceHeightTruthActors,
    },
  ];

  const funnelSteps = buildFunnelSteps(funnelInputs, startActors);
  const activation = computeActivationSummary(
    ratedWindowSessions,
    lifetimeSessions
  );
  const onboarding = computeOnboardingSummary(realProfiles);
  const telemetryCoverage = {
    beachSelectedOfStart: ratio(
      intersectionSize(beachSelectedActors, startActors),
      startActors.size
    ),
    conditionsSetOfStart: ratio(
      intersectionSize(conditionsSetActors, startActors),
      startActors.size
    ),
    submitEventOfSavedSessionUsers: ratio(
      intersectionSize(submitEventActors, savedSessionActors),
      savedSessionActors.size
    ),
  };
  const telemetryCoverageByPlatform = buildTelemetryCoverageByPlatform(
    eventActorsByTypeAndPlatform
  );
  const recentTelemetry = buildRecentTelemetryWindow(
    events,
    input.start,
    input.end,
    input.recentTelemetryDays ?? DEFAULT_RECENT_TELEMETRY_DAYS
  );
  const canonicalSessionAnalysis = computeCanonicalSessionAnalysis({
    events,
    windowSessions,
    start: input.start,
    end: input.end,
  });
  const firstSessionTelemetryCoverage = buildFirstSessionTelemetryCoverage({
    attempts: canonicalSessionAnalysis.attempts,
    firstSessionMarkers: canonicalSessionAnalysis.firstSessionMarkers,
    lifetimeSessions,
    end: input.end,
  });
  const validationBranch = buildSessionValidationBranch(
    canonicalSessionAnalysis.attempts,
    canonicalSessionAnalysis.canonicalFunnel.steps.find(
      (step) => step.key === "form_view",
    )?.users ?? 0,
  );

  const report: Omit<SessionAcquisitionReport, "readiness"> = {
    reportSchemaVersion: SESSION_ACQUISITION_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    start: input.start,
    end: input.end,
    days: daysBetween(input.start, input.end),
    eventRows: events.length,
    sessionRows: completedWindowSessions.length,
    lifetimeSessionRows: lifetimeSessions.length,
    profileRows: realProfiles.length,
    excludedEventRows: input.events.length - events.length,
    excludedSessionRows: input.windowSessions.length - windowSessions.length,
    funnelSteps,
    canonicalFunnel: canonicalSessionAnalysis.canonicalFunnel,
    validationBranch,
    firstSessionTelemetryCoverage,
    eventsByType: countBy(events, (event) => event.event_type),
    eventsByPlatform: countBy(events, platformForEvent),
    sessionsBySource: countBy(completedWindowSessions, (session) =>
      normalizeSource(session.source)
    ),
    savedSessionUsers: savedSessionActors.size,
    ratedSessionUsers: ratedSessionActors.size,
    faceHeightTruthUsers: faceHeightTruthActors.size,
    ratedFaceHeightTruthUsers: ratedFaceHeightTruthActors.size,
    savedSessions: completedWindowSessions.length,
    ratedSessions: ratedWindowSessions.length,
    faceHeightTruthSessions: faceHeightTruthSessions.length,
    ratedFaceHeightTruthSessions: ratedFaceHeightTruthSessions.length,
    abandonedActors: abandonedActors.size,
    validationFailedActors: validationFailedActors.size,
    activation,
    onboarding,
    telemetryCoverage,
    telemetryCoverageByPlatform,
    recentTelemetry,
    validationFailuresByCode,
    gaps: buildGaps({
      startActors,
      submitEventActors,
      savedSessionActors,
      ratedSessionActors,
      faceHeightTruthActors,
      ratedFaceHeightTruthActors,
      beachSelectedActors,
      conditionsSetActors,
      telemetryCoverageByPlatform,
      recentTelemetry,
      validationFailedActors,
      validationFailuresByCode,
      excludedEventRows: input.events.length - events.length,
      excludedSessionRows: input.windowSessions.length - windowSessions.length,
    }),
  };

  return {
    ...report,
    readiness: buildSessionAcquisitionReadiness(
      report,
      input.readinessCriteria ?? defaultSessionAcquisitionReadinessCriteria()
    ),
  };
}

export function renderSessionAcquisitionReport(
  report: SessionAcquisitionReport
): string {
  const validation = validateSessionAcquisitionReport(report);
  if (!validation.ok) {
    throw new Error(
      "Refusing to render invalid session acquisition report: " +
        validation.blockers.join(", ")
    );
  }
  const lines: string[] = [];
  lines.push("# Track B Session Acquisition Instrumentation Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Window: ${report.start} to ${report.end} (${report.days} days)`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `- Stored session-log event rows: ${report.eventRows.toLocaleString()}`
  );
  lines.push(
    `- Saved completed sessions: ${report.savedSessions.toLocaleString()} from ${report.savedSessionUsers.toLocaleString()} users`
  );
  lines.push(
    `- Rated completed sessions: ${report.ratedSessions.toLocaleString()} from ${report.ratedSessionUsers.toLocaleString()} users`
  );
  lines.push(
    `- Face-height truth sessions: ${report.faceHeightTruthSessions.toLocaleString()} from ${report.faceHeightTruthUsers.toLocaleString()} users`
  );
  lines.push(
    `- Rated face-height truth sessions: ${report.ratedFaceHeightTruthSessions.toLocaleString()} from ${report.ratedFaceHeightTruthUsers.toLocaleString()} users`
  );
  lines.push(
    `- Users with 5+ rated sessions in lifetime scope: ${report.activation.lifetimeScopedUsersWithFiveRatedSessions.toLocaleString()}`
  );
  lines.push("");
  lines.push("## Actor-Deduped Funnel");
  lines.push("");
  lines.push("| Step | Actors | Of start | From previous |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const step of report.funnelSteps) {
    lines.push(
      `| ${step.label} | ${step.actors.toLocaleString()} | ${formatPercent(
        step.pctOfStart
      )} | ${formatPercent(step.pctOfPrevious)} |`
    );
  }
  lines.push("");
  lines.push("## Canonical Session Funnel");
  lines.push("");
  lines.push("- Grain: unique authenticated users; flow counts are diagnostic.");
  lines.push(
    "- Correlation-complete traffic only; legacy/web rows without flow metadata remain diagnostic."
  );
  lines.push("");
  lines.push("| Step | Users | Flows | Of start | From previous |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const step of report.canonicalFunnel.steps) {
    lines.push(
      "| " +
        step.label +
        " | " +
        step.users.toLocaleString() +
        " | " +
        step.flows.toLocaleString() +
        " | " +
        formatPercent(step.pctOfStart) +
        " | " +
        formatPercent(step.pctOfPrevious) +
        " |"
    );
  }
  lines.push("");
  lines.push("### Correlation Gaps");
  lines.push("");
  lines.push("| Aggregate diagnostic | Count |");
  lines.push("| --- | ---: |");
  for (const [label, count] of [
    [
      "Funnel event rows missing user ID",
      report.canonicalFunnel.joinCoverage.funnelEventRowsMissingUserId,
    ],
    [
      "Funnel events missing flow ID",
      report.canonicalFunnel.joinCoverage.funnelEventsMissingFlowId,
    ],
    [
      "Submit events missing surf-session ID",
      report.canonicalFunnel.joinCoverage.submitEventsMissingSessionId,
    ],
    [
      "First-session markers missing surf-session ID",
      report.canonicalFunnel.joinCoverage.firstSessionMarkersMissingSessionId,
    ],
    [
      "First-session markers missing user ID",
      report.canonicalFunnel.joinCoverage.firstSessionMarkersMissingUserId,
    ],
    [
      "Funnel events with unusable client stage time",
      report.canonicalFunnel.joinCoverage
        .funnelEventsWithUnusableClientStageAt,
    ],
    [
      "Stable event-ID conflict groups",
      report.canonicalFunnel.joinCoverage.stableIdConflictGroups,
    ],
    [
      "Submit flows without a window session",
      report.canonicalFunnel.joinCoverage.submitFlowsWithoutWindowSession,
    ],
    [
      "Submit flows with session-owner mismatch",
      report.canonicalFunnel.joinCoverage
        .submitFlowsWithSessionOwnerMismatch,
    ],
    [
      "Submit flows with an ineligible session",
      report.canonicalFunnel.joinCoverage.submitFlowsWithIneligibleSession,
    ],
  ] as const) {
    lines.push(`| ${label} | ${count.toLocaleString()} |`);
  }
  lines.push("");
  lines.push("## Validation Recovery");
  lines.push("");
  lines.push("| Metric | Count / Rate |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Affected users | ${report.validationBranch.affectedUsers.toLocaleString()} |`
  );
  lines.push(
    `| Affected flows | ${report.validationBranch.affectedFlows.toLocaleString()} |`
  );
  lines.push(
    `| Affected users of form-view users | ${formatPercent(
      report.validationBranch.pctOfFormViewUsers
    )} |`
  );
  lines.push(
    `| Recovered users | ${report.validationBranch.recoveredUsers.toLocaleString()} |`
  );
  lines.push(
    `| Recovered flows | ${report.validationBranch.recoveredFlows.toLocaleString()} |`
  );
  lines.push(
    `| Recovery rate | ${formatPercent(report.validationBranch.recoveryRate)} |`
  );
  lines.push("");
  lines.push("## First-Session Telemetry Coverage");
  lines.push("");
  lines.push("| Metric | Count / Rate |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Persisted first-session users | ${report.firstSessionTelemetryCoverage.persistedFirstSessionUsers.toLocaleString()} |`
  );
  lines.push(
    `| First-session marker users | ${report.firstSessionTelemetryCoverage.markerUsers.toLocaleString()} |`
  );
  lines.push(
    `| Marker coverage | ${formatPercent(
      report.firstSessionTelemetryCoverage.coverage
    )} |`
  );
  lines.push("");
  lines.push(
    "- The fixed measurement window can right-censor offline delivery after the report end; it does not provide a mature follow-up horizon."
  );
  lines.push("");
  lines.push("## Durable Session Signal");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Completed sessions | ${report.savedSessions.toLocaleString()} |`);
  lines.push(`| Rated sessions | ${report.ratedSessions.toLocaleString()} |`);
  lines.push(
    `| Face-height truth sessions | ${report.faceHeightTruthSessions.toLocaleString()} |`
  );
  lines.push(
    `| Rated face-height truth sessions | ${report.ratedFaceHeightTruthSessions.toLocaleString()} |`
  );
  lines.push(
    `| Abandon actors | ${report.abandonedActors.toLocaleString()} |`
  );
  lines.push(
    `| Validation-failed actors | ${report.validationFailedActors.toLocaleString()} |`
  );
  lines.push("");
  lines.push("## Activation");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Users with 1+ rated session in window | ${report.activation.windowUsersWithRatedSession.toLocaleString()} |`
  );
  lines.push(
    `| Users with 3+ rated sessions in window | ${report.activation.windowUsersWithThreeRatedSessions.toLocaleString()} |`
  );
  lines.push(
    `| Users with 5+ rated sessions in window | ${report.activation.windowUsersWithFiveRatedSessions.toLocaleString()} |`
  );
  lines.push(
    `| Users with 5+ rated sessions in lifetime scope | ${report.activation.lifetimeScopedUsersWithFiveRatedSessions.toLocaleString()} |`
  );
  lines.push(
    `| Median days to 5th rating | ${formatNumber(
      report.activation.medianDaysToFifthRating
    )} |`
  );
  lines.push(
    `| P75 days to 5th rating | ${formatNumber(
      report.activation.p75DaysToFifthRating
    )} |`
  );
  lines.push("");
  lines.push("## Readiness Gate");
  lines.push("");
  lines.push(`- Verdict: ${report.readiness.verdict}`);
  lines.push(
    `- Criteria: rated sessions >= ${report.readiness.criteria.minRatedSessions.toLocaleString()}, rated users >= ${report.readiness.criteria.minRatedSessionUsers.toLocaleString()}, 5-rated-session users >= ${report.readiness.criteria.minFiveRatedSessionUsers.toLocaleString()}, face-height sessions >= ${report.readiness.criteria.minFaceHeightTruthSessions.toLocaleString()}, beach-selected coverage >= ${formatPercent(
      report.readiness.criteria.minBeachSelectedCoverage
    )}, conditions-set coverage >= ${formatPercent(
      report.readiness.criteria.minConditionsSetCoverage
    )}, submit-event coverage >= ${formatPercent(
      report.readiness.criteria.minSubmitEventCoverage
    )}, recent build metadata coverage >= ${formatPercent(
      report.readiness.criteria.minRecentBuildMetadataCoverage
    )}`
  );
  lines.push(
    `- Recent-window coverage uses the same beach-selected, conditions-set, and submit-event floors when the recent telemetry window is narrower than the report window.`
  );
  if ((report.readiness.criteria.expectedRecentClientBuilds ?? []).length > 0) {
    lines.push(
      `- Expected recent client builds: ${(report.readiness.criteria.expectedRecentClientBuilds ?? []).join(", ")}`
    );
  }
  lines.push(
    `- Observed: rated sessions ${report.readiness.observed.ratedSessions.toLocaleString()}, rated users ${report.readiness.observed.ratedSessionUsers.toLocaleString()}, 5-rated-session users ${report.readiness.observed.lifetimeScopedUsersWithFiveRatedSessions.toLocaleString()}, face-height sessions ${report.readiness.observed.faceHeightTruthSessions.toLocaleString()}, rated face-height sessions ${report.readiness.observed.ratedFaceHeightTruthSessions.toLocaleString()}, beach-selected coverage ${formatPercent(
      report.readiness.observed.beachSelectedCoverage
    )}, conditions-set coverage ${formatPercent(
      report.readiness.observed.conditionsSetCoverage
    )}, submit-event coverage ${formatPercent(
      report.readiness.observed.submitEventCoverage
    )}, recent beach-selected coverage ${formatPercent(
      report.readiness.observed.recentBeachSelectedCoverage
    )}, recent conditions-set coverage ${formatPercent(
      report.readiness.observed.recentConditionsSetCoverage
    )}, recent submit-event coverage ${formatPercent(
      report.readiness.observed.recentSubmitEventCoverage
    )}, recent build metadata coverage ${formatPercent(
      report.readiness.observed.recentBuildMetadataCoverage
    )}`
  );
  for (const finding of report.readiness.findings) {
    lines.push(`- ${finding}`);
  }
  const expectedBuilds = report.readiness.criteria.expectedRecentClientBuilds ?? [];
  if (expectedBuilds.length > 0) {
    lines.push("");
    lines.push("| Expected recent client build | Start actors |");
    lines.push("| --- | ---: |");
    for (const clientBuild of expectedBuilds) {
      lines.push(
        `| ${clientBuild} | ${(
          report.readiness.observed.expectedRecentClientBuildStartActors[
            clientBuild
          ] ?? 0
        ).toLocaleString()} |`
      );
    }
  }
  lines.push("");
  lines.push("## Onboarding Fuel");
  lines.push("");
  lines.push("| Metric | Count | Rate |");
  lines.push("| --- | ---: | ---: |");
  lines.push(
    onboardingLine("New real profiles", report.onboarding.newProfiles, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Completed onboarding", report.onboarding.completedOnboarding, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Home beach set", report.onboarding.withHomeBeach, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Experience level set", report.onboarding.withExperienceLevel, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Activity level set", report.onboarding.withActivityLevel, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Surf styles set", report.onboarding.withSurfStyles, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Preferred session time set", report.onboarding.withPreferredSessionTime, report.onboarding.newProfiles)
  );
  lines.push(
    onboardingLine("Timezone set", report.onboarding.withTimezone, report.onboarding.newProfiles)
  );
  lines.push("");
  lines.push("## Stored Event Counts");
  lines.push("");
  lines.push(renderCountTable(report.eventsByType, "Event type"));
  lines.push("");
  lines.push("## Event Platform Counts");
  lines.push("");
  lines.push(renderCountTable(report.eventsByPlatform, "Platform"));
  lines.push("");
  lines.push("## Telemetry Coverage By Platform");
  lines.push("");
  lines.push(
    "| Platform | Start actors | Form-view actors | Form-view of start | Beach-selected actors | Beach-selected of start | Conditions-set actors | Conditions-set of start | Submit actors | Submit of start |"
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  if (report.telemetryCoverageByPlatform.length === 0) {
    lines.push("| _No platform-tagged start actors._ | 0 | 0 | n/a | 0 | n/a | 0 | n/a | 0 | n/a |");
  } else {
    for (const platform of report.telemetryCoverageByPlatform) {
      lines.push(
        `| ${platform.platform} | ${platform.startActors.toLocaleString()} | ${platform.formViewActors.toLocaleString()} | ${formatPercent(
          platform.formViewOfStart
        )} | ${platform.beachSelectedActors.toLocaleString()} | ${formatPercent(
          platform.beachSelectedOfStart
        )} | ${platform.conditionsSetActors.toLocaleString()} | ${formatPercent(
          platform.conditionsSetOfStart
        )} | ${platform.submitEventActors.toLocaleString()} | ${formatPercent(
          platform.submitEventOfStart
        )} |`
      );
    }
  }
  lines.push("");
  lines.push("## Recent Telemetry Window");
  lines.push("");
  lines.push(
    `Window: ${report.recentTelemetry.start} to ${report.recentTelemetry.end} (${report.recentTelemetry.days} days)`
  );
  lines.push("");
  lines.push("| Metric | Count / Rate |");
  lines.push("| --- | ---: |");
  lines.push(
    `| Event rows | ${report.recentTelemetry.eventRows.toLocaleString()} |`
  );
  lines.push(
    `| Start actors | ${report.recentTelemetry.startActors.toLocaleString()} |`
  );
  lines.push(
    `| Start actors without version/build metadata | ${report.recentTelemetry.startActorsWithoutBuildMetadata.toLocaleString()} |`
  );
  lines.push(
    `| Form-view of start | ${formatPercent(
      report.recentTelemetry.formViewOfStart
    )} |`
  );
  lines.push(
    `| Beach-selected of start | ${formatPercent(
      report.recentTelemetry.beachSelectedOfStart
    )} |`
  );
  lines.push(
    `| Conditions-set of start | ${formatPercent(
      report.recentTelemetry.conditionsSetOfStart
    )} |`
  );
  lines.push(
    `| Submit event of start | ${formatPercent(
      report.recentTelemetry.submitEventOfStart
    )} |`
  );
  lines.push("");
  lines.push("| Platform | Start actors | Form-view of start | Beach-selected of start | Conditions-set of start | Submit of start |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  if (report.recentTelemetry.telemetryCoverageByPlatform.length === 0) {
    lines.push("| _No platform-tagged start actors._ | 0 | n/a | n/a | n/a | n/a |");
  } else {
    for (const platform of report.recentTelemetry.telemetryCoverageByPlatform) {
      lines.push(
        `| ${platform.platform} | ${platform.startActors.toLocaleString()} | ${formatPercent(
          platform.formViewOfStart
        )} | ${formatPercent(
          platform.beachSelectedOfStart
        )} | ${formatPercent(
          platform.conditionsSetOfStart
        )} | ${formatPercent(platform.submitEventOfStart)} |`
      );
    }
  }
  lines.push("");
  lines.push("| Client build | Start actors | Form-view of start | Beach-selected of start | Conditions-set of start | Submit of start |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  if (report.recentTelemetry.telemetryCoverageByClientBuild.length === 0) {
    lines.push("| _No client-build-tagged start actors._ | 0 | n/a | n/a | n/a | n/a |");
  } else {
    for (const clientBuild of report.recentTelemetry.telemetryCoverageByClientBuild) {
      lines.push(
        `| ${clientBuild.clientBuild} | ${clientBuild.startActors.toLocaleString()} | ${formatPercent(
          clientBuild.formViewOfStart
        )} | ${formatPercent(
          clientBuild.beachSelectedOfStart
        )} | ${formatPercent(
          clientBuild.conditionsSetOfStart
        )} | ${formatPercent(clientBuild.submitEventOfStart)} |`
      );
    }
  }
  lines.push("");
  lines.push("## Validation Failure Codes");
  lines.push("");
  lines.push("| Error code | Events | Actors | Top platform |");
  lines.push("| --- | ---: | ---: | --- |");
  if (report.validationFailuresByCode.length === 0) {
    lines.push("| _No validation failures._ | 0 | 0 | n/a |");
  } else {
    for (const failure of report.validationFailuresByCode) {
      lines.push(
        `| ${failure.code} | ${failure.events.toLocaleString()} | ${failure.actors.toLocaleString()} | ${topPlatformLabel(
          failure.platforms
        )} |`
      );
    }
  }
  lines.push("");
  lines.push("## Session Source Counts");
  lines.push("");
  lines.push(renderCountTable(report.sessionsBySource, "Source"));
  lines.push("");
  lines.push("## Gaps");
  lines.push("");
  if (report.gaps.length === 0) {
    lines.push("- No actionable instrumentation gaps detected in this window.");
  } else {
    for (const gap of report.gaps) lines.push(`- ${gap}`);
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push(
    "- Raw user, flow, event, and surf-session IDs are used only in-memory for dedupe and correlation and are not rendered."
  );
  lines.push(
    "- Saved completed sessions are the durable conversion source; stored submit events are treated as telemetry coverage."
  );
  lines.push(
    "- Mock, system, deleted, analytics-excluded, and bot-flagged rows are excluded when profile flags are available."
  );
  return `${lines.join("\n")}\n`;
}

export function writeSessionAcquisitionReportJson(
  outputJsonPath: string,
  report: SessionAcquisitionReport
): string {
  const validation = validateSessionAcquisitionReport(report);
  if (!validation.ok) {
    throw new Error(
      "Refusing to write invalid session acquisition report: " +
        validation.blockers.join(", ")
    );
  }
  const resolvedPath = resolve(outputJsonPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(report, null, 2)}\n`);
  return resolvedPath;
}

export function validateSessionAcquisitionReport(
  report: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): SessionAcquisitionReportValidationResult {
  const blockers: string[] = [];
  try {
    const serializedReport = JSON.stringify(report);
    if (serializedReport === undefined) {
      blockers.push("report_not_serializable");
    } else if (UUID_PATTERN.test(serializedReport)) {
      blockers.push("report_contains_uuid");
    }
  } catch {
    blockers.push("report_not_serializable");
  }

  if (!isRecord(report)) {
    return {
      ok: false,
      blockers: [...blockers, "report_not_object"],
    };
  }

  validateExactObjectKeys(
    report,
    SESSION_ACQUISITION_REPORT_KEYS,
    "report_keys_invalid",
    blockers
  );
  validateAggregateOnlyReportPrivacy(report, blockers);
  if (
    report.reportSchemaVersion !== SESSION_ACQUISITION_REPORT_SCHEMA_VERSION
  ) {
    blockers.push("report_schema_version_invalid");
  }
  validateGeneratedAt(report.generatedAt, options, blockers);
  validateUtcTimestampField(report.start, "start_invalid", blockers);
  validateUtcTimestampField(report.end, "end_invalid", blockers);
  if (
    isUtcTimestamp(report.start) &&
    isUtcTimestamp(report.end) &&
    Date.parse(report.start) >= Date.parse(report.end)
  ) {
    blockers.push("measurement_window_invalid");
  }
  validateReportWindowFreshness(report, options, blockers);
  validateNonNegativeIntegerField(report.days, "days_invalid", blockers);
  if (
    isUtcTimestamp(report.start) &&
    isUtcTimestamp(report.end) &&
    isNonNegativeIntegerValue(report.days) &&
    report.days !== daysBetween(report.start, report.end)
  ) {
    blockers.push("days_mismatch");
  }

  for (const field of [
    "eventRows",
    "sessionRows",
    "lifetimeSessionRows",
    "profileRows",
    "excludedEventRows",
    "excludedSessionRows",
    "savedSessionUsers",
    "ratedSessionUsers",
    "faceHeightTruthUsers",
    "ratedFaceHeightTruthUsers",
    "savedSessions",
    "ratedSessions",
    "faceHeightTruthSessions",
    "ratedFaceHeightTruthSessions",
    "abandonedActors",
    "validationFailedActors",
  ] as const) {
    validateNonNegativeIntegerField(report[field], `${field}_invalid`, blockers);
  }
  validateSessionAcquisitionCountRelationships(report, blockers);
  validateFunnelSteps(report.funnelSteps, blockers);
  validateCanonicalFunnel(report.canonicalFunnel, blockers);
  validateValidationBranch(
    report.validationBranch,
    report.canonicalFunnel,
    blockers
  );
  validateFirstSessionTelemetryCoverage(
    report.firstSessionTelemetryCoverage,
    report.canonicalFunnel,
    blockers
  );
  validateCountMap(report.eventsByType, "events_by_type_invalid", blockers);
  validatePlatformCountMap(
    report.eventsByPlatform,
    "events_by_platform_invalid",
    "events_by_platform_invalid_label",
    blockers
  );
  validateCountMap(
    report.sessionsBySource,
    "sessions_by_source_invalid",
    blockers
  );
  validateActivationSummary(report.activation, blockers);
  validateOnboardingSummary(report.onboarding, blockers);
  validateTelemetryCoverage(report.telemetryCoverage, blockers);
  validateTelemetryCoverageConsistency(report, blockers);
  validateTelemetryPlatformCoverageArray(
    report.telemetryCoverageByPlatform,
    "telemetry_coverage_by_platform_invalid",
    blockers
  );
  validateRecentTelemetry(report.recentTelemetry, blockers);
  validateValidationFailures(report.validationFailuresByCode, blockers);
  validateStringArray(report.gaps, "gaps_invalid", blockers);
  validateReadiness(report.readiness, blockers);
  validateReadinessConsistency(report, blockers);

  return {
    ok: blockers.length === 0,
    blockers,
  };
}

export function validateSessionAcquisitionReportFile(
  inputJsonPath: string,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  } = {}
): SessionAcquisitionReportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(inputJsonPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      blockers: [
        `report_json_unreadable:${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }

  return validateSessionAcquisitionReport(parsed, options);
}

function validateGeneratedAt(
  generatedAt: unknown,
  options: {
    maxReportAgeHours?: number | null;
    now?: Date;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(generatedAt)) {
    blockers.push("generated_at_invalid");
    return;
  }

  const now = options.now ?? new Date();
  const generatedAtDate = new Date(generatedAt);
  const ageMs = now.getTime() - generatedAtDate.getTime();
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push("generated_at_in_future");
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push("generated_at_too_old");
  }
}

function validateReportWindowFreshness(
  report: Record<string, unknown>,
  options: {
    maxReportAgeHours?: number | null;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(report.generatedAt)) {
    return;
  }

  validateTimestampFreshnessAgainstGeneratedAt(
    report.end,
    report.generatedAt,
    "measurement_end_after_generated_at",
    "measurement_end_too_old",
    options,
    blockers
  );

  if (!isRecord(report.recentTelemetry)) {
    return;
  }
  validateTimestampFreshnessAgainstGeneratedAt(
    report.recentTelemetry.end,
    report.generatedAt,
    "recent_telemetry_end_after_generated_at",
    "recent_telemetry_end_too_old",
    options,
    blockers
  );
}

function validateTimestampFreshnessAgainstGeneratedAt(
  value: unknown,
  generatedAt: string,
  futureBlockerCode: string,
  staleBlockerCode: string,
  options: {
    maxReportAgeHours?: number | null;
  },
  blockers: string[]
): void {
  if (!isUtcTimestamp(value)) {
    return;
  }

  const ageMs = Date.parse(generatedAt) - Date.parse(value);
  if (ageMs < -MAX_GENERATED_AT_FUTURE_SKEW_MS) {
    blockers.push(futureBlockerCode);
  }
  if (
    typeof options.maxReportAgeHours === "number" &&
    ageMs > options.maxReportAgeHours * 60 * 60 * 1000
  ) {
    blockers.push(staleBlockerCode);
  }
}

function validateSessionAcquisitionCountRelationships(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const relationships = [
    ["ratedSessions", "savedSessions", "rated_sessions_exceed_saved"],
    [
      "faceHeightTruthSessions",
      "savedSessions",
      "face_height_sessions_exceed_saved",
    ],
    [
      "ratedFaceHeightTruthSessions",
      "ratedSessions",
      "rated_face_height_sessions_exceed_rated",
    ],
    [
      "ratedFaceHeightTruthSessions",
      "faceHeightTruthSessions",
      "rated_face_height_sessions_exceed_face_height",
    ],
    ["ratedSessionUsers", "savedSessionUsers", "rated_users_exceed_saved"],
    [
      "faceHeightTruthUsers",
      "savedSessionUsers",
      "face_height_users_exceed_saved",
    ],
    [
      "ratedFaceHeightTruthUsers",
      "ratedSessionUsers",
      "rated_face_height_users_exceed_rated",
    ],
    [
      "ratedFaceHeightTruthUsers",
      "faceHeightTruthUsers",
      "rated_face_height_users_exceed_face_height",
    ],
  ] as const;

  for (const [leftField, rightField, blockerCode] of relationships) {
    const left = report[leftField];
    const right = report[rightField];
    if (
      isNonNegativeIntegerValue(left) &&
      isNonNegativeIntegerValue(right) &&
      left > right
    ) {
      blockers.push(blockerCode);
    }
  }
}

function validateExactObjectKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  blockerCode: string,
  blockers: string[]
): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    blockers.push(blockerCode);
  }
}

function validateCanonicalFunnel(value: unknown, blockers: string[]): void {
  if (!isRecord(value)) {
    blockers.push("canonical_funnel_invalid");
    return;
  }
  validateExactObjectKeys(
    value,
    CANONICAL_FUNNEL_KEYS,
    "canonical_funnel_keys_invalid",
    blockers
  );
  if (value.grain !== "unique_user") {
    blockers.push("canonical_funnel_grain_invalid");
  }
  if (value.ordering !== "metadata.client_stage_at") {
    blockers.push("canonical_funnel_ordering_invalid");
  }

  const steps = value.steps;
  if (!Array.isArray(steps)) {
    blockers.push("canonical_funnel_steps_invalid");
  } else {
    const actualOrder = steps.map((step) =>
      isRecord(step) && typeof step.key === "string" ? step.key : null
    );
    if (
      actualOrder.length !== CANONICAL_STEP_ORDER.length ||
      actualOrder.some((key, index) => key !== CANONICAL_STEP_ORDER[index])
    ) {
      blockers.push("canonical_funnel_step_order_invalid");
    }

    let stepShapeInvalid = false;
    let stepCountsInvalid = false;
    let stepRateInvalid = false;
    for (const step of steps) {
      if (!isRecord(step)) {
        stepShapeInvalid = true;
        continue;
      }
      validateExactObjectKeys(
        step,
        CANONICAL_STEP_KEYS,
        "canonical_funnel_step_keys_invalid",
        blockers
      );
      if (typeof step.key !== "string" || typeof step.label !== "string") {
        stepShapeInvalid = true;
      }
      if (
        !isNonNegativeIntegerValue(step.users) ||
        !isNonNegativeIntegerValue(step.flows)
      ) {
        stepCountsInvalid = true;
      }
      if (
        readRateOrNull(step.pctOfStart) === undefined ||
        readRateOrNull(step.pctOfPrevious) === undefined
      ) {
        stepRateInvalid = true;
      }
    }
    if (stepShapeInvalid) blockers.push("canonical_funnel_step_shape_invalid");
    if (stepCountsInvalid) blockers.push("canonical_funnel_step_counts_invalid");
    if (stepRateInvalid) blockers.push("canonical_funnel_rate_invalid");

    const validSteps = steps.every(
      (step) =>
        isRecord(step) &&
        isNonNegativeIntegerValue(step.users) &&
        isNonNegativeIntegerValue(step.flows)
    );
    if (validSteps) {
      const typedSteps = steps as Record<string, unknown>[];
      if (typedSteps.some((step) => step.users! > step.flows!)) {
        blockers.push("canonical_funnel_users_exceed_flows");
      }
      if (
        typedSteps.some(
          (step, index) =>
            index > 0 && step.users! > typedSteps[index - 1].users!
        )
      ) {
        blockers.push("canonical_funnel_users_non_monotonic");
      }
      if (
        typedSteps.some(
          (step, index) =>
            index > 0 && step.flows! > typedSteps[index - 1].flows!
        )
      ) {
        blockers.push("canonical_funnel_flows_non_monotonic");
      }

      const startUsers = typedSteps[0]?.users as number | undefined;
      let rateMismatch = false;
      for (const [index, step] of typedSteps.entries()) {
        if (typeof startUsers !== "number") break;
        const expectedPctOfStart =
          index === 0 ? (startUsers > 0 ? 1 : null) : ratio(step.users as number, startUsers);
        const expectedPctOfPrevious =
          index === 0
            ? null
            : ratio(step.users as number, typedSteps[index - 1].users as number);
        if (
          !exactNullableNumbersMatch(step.pctOfStart, expectedPctOfStart) ||
          !exactNullableNumbersMatch(
            step.pctOfPrevious,
            expectedPctOfPrevious
          )
        ) {
          rateMismatch = true;
        }
      }
      if (rateMismatch) blockers.push("canonical_funnel_rate_mismatch");
    }
  }

  const joinCoverage = value.joinCoverage;
  if (!isRecord(joinCoverage)) {
    blockers.push("canonical_join_coverage_invalid");
    return;
  }
  validateExactObjectKeys(
    joinCoverage,
    CANONICAL_JOIN_COVERAGE_KEYS,
    "canonical_join_coverage_keys_invalid",
    blockers
  );
  const submitFlowsWithoutWindowSession =
    joinCoverage.submitFlowsWithoutWindowSession;
  const submitFlowsWithSessionOwnerMismatch =
    joinCoverage.submitFlowsWithSessionOwnerMismatch;
  const submitFlowsWithIneligibleSession =
    joinCoverage.submitFlowsWithIneligibleSession;
  if (
    !CANONICAL_JOIN_COVERAGE_KEYS.every((key) =>
      isNonNegativeIntegerValue(joinCoverage[key])
    ) ||
    !isNonNegativeIntegerValue(submitFlowsWithoutWindowSession) ||
    !isNonNegativeIntegerValue(submitFlowsWithSessionOwnerMismatch) ||
    !isNonNegativeIntegerValue(submitFlowsWithIneligibleSession)
  ) {
    blockers.push("canonical_join_coverage_counts_invalid");
    return;
  }
  if (!Array.isArray(steps)) return;
  const submit = steps.find(
    (step) => isRecord(step) && step.key === "submit"
  );
  const persisted = steps.find(
    (step) => isRecord(step) && step.key === "persisted_session"
  );
  if (
    !isRecord(submit) ||
    !isRecord(persisted) ||
    !isNonNegativeIntegerValue(submit.flows) ||
    !isNonNegativeIntegerValue(persisted.flows)
  ) {
    return;
  }
  const rejectedFlows =
    submitFlowsWithoutWindowSession +
    submitFlowsWithSessionOwnerMismatch +
    submitFlowsWithIneligibleSession;
  if (rejectedFlows !== submit.flows - persisted.flows) {
    blockers.push("canonical_persistence_rejection_partition_invalid");
  }
}

function validateValidationBranch(
  value: unknown,
  canonicalFunnel: unknown,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("validation_branch_invalid");
    return;
  }
  validateExactObjectKeys(
    value,
    VALIDATION_BRANCH_KEYS,
    "validation_branch_keys_invalid",
    blockers
  );
  const countFields = [
    "affectedUsers",
    "affectedFlows",
    "recoveredUsers",
    "recoveredFlows",
  ] as const;
  if (countFields.some((field) => !isNonNegativeIntegerValue(value[field]))) {
    blockers.push("validation_branch_counts_invalid");
    return;
  }
  const pctOfFormViewUsers = readRateOrNull(value.pctOfFormViewUsers);
  const recoveryRate = readRateOrNull(value.recoveryRate);
  if (pctOfFormViewUsers === undefined || recoveryRate === undefined) {
    blockers.push("validation_branch_rate_invalid");
  }

  const formView = findCanonicalStep(canonicalFunnel, "form_view");
  const submit = findCanonicalStep(canonicalFunnel, "submit");
  if (!formView || !submit) return;
  const formViewUsers = readNonNegativeInteger(formView.users);
  const formViewFlows = readNonNegativeInteger(formView.flows);
  const submitUsers = readNonNegativeInteger(submit.users);
  const submitFlows = readNonNegativeInteger(submit.flows);
  if (
    formViewUsers === null ||
    formViewFlows === null ||
    submitUsers === null ||
    submitFlows === null
  ) {
    return;
  }
  const affectedUsers = value.affectedUsers as number;
  const affectedFlows = value.affectedFlows as number;
  const recoveredUsers = value.recoveredUsers as number;
  const recoveredFlows = value.recoveredFlows as number;
  if (
    affectedUsers > affectedFlows ||
    affectedUsers > formViewUsers ||
    affectedFlows > formViewFlows ||
    recoveredUsers > recoveredFlows ||
    recoveredUsers > affectedUsers ||
    recoveredUsers > submitUsers ||
    recoveredFlows > affectedFlows ||
    recoveredFlows > submitFlows
  ) {
    blockers.push("validation_branch_counts_inconsistent");
  }
  if (
    !exactNullableNumbersMatch(
      value.pctOfFormViewUsers,
      ratio(affectedUsers, formViewUsers)
    ) ||
    !exactNullableNumbersMatch(
      value.recoveryRate,
      ratio(recoveredUsers, affectedUsers)
    )
  ) {
    blockers.push("validation_branch_rate_mismatch");
  }
}

function validateFirstSessionTelemetryCoverage(
  value: unknown,
  canonicalFunnel: unknown,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push("first_session_telemetry_invalid");
    return;
  }
  validateExactObjectKeys(
    value,
    FIRST_SESSION_TELEMETRY_KEYS,
    "first_session_telemetry_keys_invalid",
    blockers
  );
  if (
    !isNonNegativeIntegerValue(value.persistedFirstSessionUsers) ||
    !isNonNegativeIntegerValue(value.markerUsers)
  ) {
    blockers.push("first_session_telemetry_counts_invalid");
    return;
  }
  if (readRateOrNull(value.coverage) === undefined) {
    blockers.push("first_session_telemetry_rate_invalid");
  }
  const persistedStep = findCanonicalStep(canonicalFunnel, "persisted_session");
  if (!persistedStep) return;
  const persistedUsers = readNonNegativeInteger(persistedStep.users);
  if (persistedUsers === null) return;
  const persistedFirstSessionUsers = value.persistedFirstSessionUsers;
  const markerUsers = value.markerUsers;
  if (
    persistedFirstSessionUsers > persistedUsers ||
    markerUsers > persistedFirstSessionUsers
  ) {
    blockers.push("first_session_telemetry_counts_inconsistent");
  }
  if (
    !exactNullableNumbersMatch(
      value.coverage,
      ratio(markerUsers, persistedFirstSessionUsers)
    )
  ) {
    blockers.push("first_session_telemetry_rate_mismatch");
  }
}

function validateAggregateOnlyReportPrivacy(
  value: unknown,
  blockers: string[]
): void {
  let containsIdentifierKey = false;
  let containsIdentifierEvidence = false;
  let containsUuid = false;
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown): void => {
    if (typeof candidate === "string") {
      if (UUID_PATTERN.test(candidate)) containsUuid = true;
      if (UNSAFE_IDENTIFIER_EVIDENCE_PATTERN.test(candidate)) {
        containsIdentifierEvidence = true;
      }
      return;
    }
    if (typeof candidate !== "object" || candidate === null) return;
    if (visited.has(candidate)) return;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    for (const [key, nestedValue] of Object.entries(candidate)) {
      if (UNSAFE_IDENTIFIER_KEYS.has(key)) containsIdentifierKey = true;
      visit(nestedValue);
    }
  };
  visit(value);
  if (containsUuid && !blockers.includes("report_contains_uuid")) {
    blockers.push("report_contains_uuid");
  }
  if (containsIdentifierKey) blockers.push("report_contains_identifier_key");
  if (containsIdentifierEvidence) {
    blockers.push("report_contains_identifier_evidence");
  }
}

function findCanonicalStep(
  canonicalFunnel: unknown,
  key: CanonicalSessionFunnelStepKey
): Record<string, unknown> | null {
  if (!isRecord(canonicalFunnel) || !Array.isArray(canonicalFunnel.steps)) {
    return null;
  }
  const step = canonicalFunnel.steps.find(
    (candidate) => isRecord(candidate) && candidate.key === key
  );
  return isRecord(step) ? step : null;
}

function validateFunnelSteps(value: unknown, blockers: string[]): void {
  if (!Array.isArray(value)) {
    blockers.push("funnel_steps_invalid");
    return;
  }
  for (const step of value) {
    if (!isRecord(step)) {
      blockers.push("funnel_steps_invalid");
      return;
    }
    if (typeof step.key !== "string" || typeof step.label !== "string") {
      blockers.push("funnel_steps_invalid");
      return;
    }
    for (const field of ["actors", "actorsWithStart"] as const) {
      if (!isNonNegativeIntegerValue(step[field])) {
        blockers.push("funnel_steps_invalid");
        return;
      }
    }
    validateRateOrNull(step.pctOfStart, "funnel_steps_rate_invalid", blockers);
    validateRateOrNull(
      step.pctOfPrevious,
      "funnel_steps_rate_invalid",
      blockers
    );
  }
}

function validateActivationSummary(
  activation: unknown,
  blockers: string[]
): void {
  if (!isRecord(activation)) {
    blockers.push("activation_invalid");
    return;
  }
  for (const field of [
    "windowUsersWithRatedSession",
    "windowUsersWithThreeRatedSessions",
    "windowUsersWithFiveRatedSessions",
    "lifetimeScopedUsersWithFiveRatedSessions",
  ] as const) {
    validateNonNegativeIntegerField(
      activation[field],
      `activation_${field}_invalid`,
      blockers
    );
  }
  for (const field of ["medianDaysToFifthRating", "p75DaysToFifthRating"] as const) {
    if (activation[field] !== null && !isNonNegativeFiniteNumber(activation[field])) {
      blockers.push(`activation_${field}_invalid`);
    }
  }
}

function validateOnboardingSummary(
  onboarding: unknown,
  blockers: string[]
): void {
  if (!isRecord(onboarding)) {
    blockers.push("onboarding_invalid");
    return;
  }
  for (const field of [
    "newProfiles",
    "completedOnboarding",
    "withHomeBeach",
    "withExperienceLevel",
    "withActivityLevel",
    "withSurfStyles",
    "withPreferredSessionTime",
    "withTimezone",
  ] as const) {
    validateNonNegativeIntegerField(
      onboarding[field],
      `onboarding_${field}_invalid`,
      blockers
    );
  }
}

function validateTelemetryCoverage(
  coverage: unknown,
  blockers: string[]
): void {
  if (!isRecord(coverage)) {
    blockers.push("telemetry_coverage_invalid");
    return;
  }
  for (const field of [
    "beachSelectedOfStart",
    "conditionsSetOfStart",
    "submitEventOfSavedSessionUsers",
  ] as const) {
    validateRateOrNull(
      coverage[field],
      `telemetry_coverage_${field}_invalid`,
      blockers
    );
  }
}

function validateTelemetryCoverageConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  if (!isRecord(report.telemetryCoverage)) {
    return;
  }
  const startStep = findFunnelStep(report.funnelSteps, "form_started");
  const beachSelectedStep = findFunnelStep(
    report.funnelSteps,
    "beach_selected_event"
  );
  const conditionsSetStep = findFunnelStep(
    report.funnelSteps,
    "conditions_set_event"
  );
  for (const { coverageField, step } of [
    {
      coverageField: "beachSelectedOfStart",
      step: beachSelectedStep,
    },
    {
      coverageField: "conditionsSetOfStart",
      step: conditionsSetStep,
    },
  ] as const) {
    const coverageRate = readRateOrNull(
      report.telemetryCoverage[coverageField]
    );
    const stepRate = step ? readRateOrNull(step.pctOfStart) : undefined;
    if (
      coverageRate !== undefined &&
      stepRate !== undefined &&
      !nullableNumbersMatch(coverageRate, stepRate)
    ) {
      blockers.push("telemetry_coverage_funnel_mismatch");
      return;
    }
  }

  const savedSessionUsers = readNonNegativeInteger(report.savedSessionUsers);
  const submitEventCoverage = readRateOrNull(
    report.telemetryCoverage.submitEventOfSavedSessionUsers
  );
  if (
    savedSessionUsers !== null &&
    submitEventCoverage !== undefined &&
    ((savedSessionUsers === 0 && submitEventCoverage !== null) ||
      (savedSessionUsers > 0 && submitEventCoverage === null))
  ) {
    blockers.push("telemetry_coverage_submit_denominator_mismatch");
  }

  const startActors = startStep
    ? readNonNegativeInteger(startStep.actors)
    : null;
  for (const { coverageField, step } of [
    {
      coverageField: "beachSelectedOfStart",
      step: beachSelectedStep,
    },
    {
      coverageField: "conditionsSetOfStart",
      step: conditionsSetStep,
    },
  ] as const) {
    const coverageRate = readRateOrNull(
      report.telemetryCoverage[coverageField]
    );
    if (
      startActors !== null &&
      coverageRate !== undefined &&
      ((startActors === 0 && coverageRate !== null) ||
        (startActors > 0 && coverageRate === null))
    ) {
      blockers.push("telemetry_coverage_start_denominator_mismatch");
      return;
    }
    if (!step || startActors === null) {
      continue;
    }
    const actorsWithStart = readNonNegativeInteger(step.actorsWithStart);
    if (
      actorsWithStart !== null &&
      coverageRate !== undefined &&
      !nullableNumbersMatch(coverageRate, ratio(actorsWithStart, startActors))
    ) {
      blockers.push("telemetry_coverage_funnel_mismatch");
      return;
    }
  }
}

function validateTelemetryPlatformCoverageArray(
  coverage: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!Array.isArray(coverage)) {
    blockers.push(blockerCode);
    return;
  }
  for (const row of coverage) {
    if (!isRecord(row) || typeof row.platform !== "string") {
      blockers.push(blockerCode);
      return;
    }
    if (!isSafePlatformLabel(row.platform)) {
      blockers.push(`${blockerCode}_label`);
      return;
    }
    for (const field of [
      "startActors",
      "formViewActors",
      "formViewActorsWithStart",
      "beachSelectedActors",
      "beachSelectedActorsWithStart",
      "conditionsSetActors",
      "conditionsSetActorsWithStart",
      "submitEventActors",
      "submitActorsWithStart",
    ] as const) {
      if (!isNonNegativeIntegerValue(row[field])) {
        blockers.push(blockerCode);
        return;
      }
    }
    for (const field of [
      "formViewOfStart",
      "beachSelectedOfStart",
      "conditionsSetOfStart",
      "submitEventOfStart",
    ] as const) {
      validateRateOrNull(row[field], `${blockerCode}_rate`, blockers);
    }
    validateActorCoverageCounts(row, blockerCode, blockers);
  }
}

function validateTelemetryClientBuildCoverageArray(
  coverage: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!Array.isArray(coverage)) {
    blockers.push(blockerCode);
    return;
  }
  for (const row of coverage) {
    if (
      !isRecord(row) ||
      typeof row.clientBuild !== "string" ||
      typeof row.hasVersionMetadata !== "boolean" ||
      typeof row.hasBuildMetadata !== "boolean"
    ) {
      blockers.push(blockerCode);
      return;
    }
    if (!isSafeClientBuildLabel(row.clientBuild)) {
      blockers.push(`${blockerCode}_label`);
      return;
    }
    for (const field of [
      "startActors",
      "formViewActors",
      "formViewActorsWithStart",
      "beachSelectedActors",
      "beachSelectedActorsWithStart",
      "conditionsSetActors",
      "conditionsSetActorsWithStart",
      "submitEventActors",
      "submitActorsWithStart",
    ] as const) {
      if (!isNonNegativeIntegerValue(row[field])) {
        blockers.push(blockerCode);
        return;
      }
    }
    for (const field of [
      "formViewOfStart",
      "beachSelectedOfStart",
      "conditionsSetOfStart",
      "submitEventOfStart",
    ] as const) {
      validateRateOrNull(row[field], `${blockerCode}_rate`, blockers);
    }
    validateActorCoverageCounts(row, blockerCode, blockers);
  }
}

function findFunnelStep(
  funnelSteps: unknown,
  key: string
): Record<string, unknown> | null {
  if (!Array.isArray(funnelSteps)) {
    return null;
  }
  const step = funnelSteps.find(
    (candidate) => isRecord(candidate) && candidate.key === key
  );
  return isRecord(step) ? step : null;
}

function validateRecentTelemetry(
  recentTelemetry: unknown,
  blockers: string[]
): void {
  if (!isRecord(recentTelemetry)) {
    blockers.push("recent_telemetry_invalid");
    return;
  }
  validateUtcTimestampField(
    recentTelemetry.start,
    "recent_telemetry_start_invalid",
    blockers
  );
  validateUtcTimestampField(
    recentTelemetry.end,
    "recent_telemetry_end_invalid",
    blockers
  );
  if (
    isUtcTimestamp(recentTelemetry.start) &&
    isUtcTimestamp(recentTelemetry.end) &&
    Date.parse(recentTelemetry.start) >= Date.parse(recentTelemetry.end)
  ) {
    blockers.push("recent_telemetry_window_invalid");
  }
  for (const field of [
    "days",
    "eventRows",
    "startActors",
    "startActorsWithoutBuildMetadata",
    "formViewActors",
    "formViewActorsWithStart",
    "beachSelectedActors",
    "beachSelectedActorsWithStart",
    "conditionsSetActors",
    "conditionsSetActorsWithStart",
    "submitEventActors",
    "submitActorsWithStart",
  ] as const) {
    validateNonNegativeIntegerField(
      recentTelemetry[field],
      `recent_telemetry_${field}_invalid`,
      blockers
    );
  }
  for (const field of [
    "formViewOfStart",
    "beachSelectedOfStart",
    "conditionsSetOfStart",
    "submitEventOfStart",
  ] as const) {
    validateRateOrNull(
      recentTelemetry[field],
      `recent_telemetry_${field}_invalid`,
      blockers
    );
  }
  if (
    isUtcTimestamp(recentTelemetry.start) &&
    isUtcTimestamp(recentTelemetry.end) &&
    isNonNegativeIntegerValue(recentTelemetry.days) &&
    recentTelemetry.days !==
      daysBetween(recentTelemetry.start, recentTelemetry.end)
  ) {
    blockers.push("recent_telemetry_days_mismatch");
  }
  validateRecentTelemetryCountConsistency(recentTelemetry, blockers);
  validateTelemetryPlatformCoverageArray(
    recentTelemetry.telemetryCoverageByPlatform,
    "recent_telemetry_platform_coverage_invalid",
    blockers
  );
  validateTelemetryClientBuildCoverageArray(
    recentTelemetry.telemetryCoverageByClientBuild,
    "recent_telemetry_client_build_coverage_invalid",
    blockers
  );
  validateValidationFailures(
    recentTelemetry.validationFailuresByCode,
    "recent_telemetry_validation_failures_invalid",
    blockers
  );
}

function validateValidationFailures(
  failures: unknown,
  blockers: string[]
): void;
function validateValidationFailures(
  failures: unknown,
  blockerCode: string,
  blockers: string[]
): void;
function validateValidationFailures(
  failures: unknown,
  blockerCodeOrBlockers: string | string[],
  maybeBlockers?: string[]
): void {
  const blockerCode =
    typeof blockerCodeOrBlockers === "string"
      ? blockerCodeOrBlockers
      : "validation_failures_invalid";
  const blockers =
    typeof blockerCodeOrBlockers === "string"
      ? maybeBlockers ?? []
      : blockerCodeOrBlockers;
  if (!Array.isArray(failures)) {
    blockers.push(blockerCode);
    return;
  }
  for (const failure of failures) {
    if (!isRecord(failure) || typeof failure.code !== "string") {
      blockers.push(blockerCode);
      return;
    }
    if (!isSanitizedValidationFailureCode(failure.code)) {
      blockers.push(`${blockerCode}_code`);
      return;
    }
    if (
      !isNonNegativeIntegerValue(failure.events) ||
      !isNonNegativeIntegerValue(failure.actors)
    ) {
      blockers.push(blockerCode);
      return;
    }
    if (failure.actors > failure.events) {
      blockers.push(`${blockerCode}_counts`);
      return;
    }
    validatePlatformCountMap(
      failure.platforms,
      `${blockerCode}_platforms`,
      `${blockerCode}_platforms_label`,
      blockers
    );
    if (
      isRecord(failure.platforms) &&
      sumCountMap(failure.platforms) !== failure.events
    ) {
      blockers.push(`${blockerCode}_platform_counts`);
      return;
    }
  }
}

function validateRecentTelemetryCountConsistency(
  recentTelemetry: Record<string, unknown>,
  blockers: string[]
): void {
  const startActors = readNonNegativeInteger(recentTelemetry.startActors);
  const startActorsWithoutBuildMetadata = readNonNegativeInteger(
    recentTelemetry.startActorsWithoutBuildMetadata
  );
  if (
    startActors !== null &&
    startActorsWithoutBuildMetadata !== null &&
    startActorsWithoutBuildMetadata > startActors
  ) {
    blockers.push("recent_telemetry_build_metadata_counts_inconsistent");
  }

  validateActorCoverageCounts(
    recentTelemetry,
    "recent_telemetry",
    blockers
  );
}

function validateActorCoverageCounts(
  row: Record<string, unknown>,
  blockerCode: string,
  blockers: string[]
): void {
  const startActors = readNonNegativeInteger(row.startActors);
  if (startActors === null) {
    return;
  }

  for (const {
    actorsField,
    actorsWithStartField,
    rateField,
  } of [
    {
      actorsField: "formViewActors",
      actorsWithStartField: "formViewActorsWithStart",
      rateField: "formViewOfStart",
    },
    {
      actorsField: "beachSelectedActors",
      actorsWithStartField: "beachSelectedActorsWithStart",
      rateField: "beachSelectedOfStart",
    },
    {
      actorsField: "conditionsSetActors",
      actorsWithStartField: "conditionsSetActorsWithStart",
      rateField: "conditionsSetOfStart",
    },
    {
      actorsField: "submitEventActors",
      actorsWithStartField: "submitActorsWithStart",
      rateField: "submitEventOfStart",
    },
  ] as const) {
    const actors = readNonNegativeInteger(row[actorsField]);
    const actorsWithStart = readNonNegativeInteger(row[actorsWithStartField]);
    const coverageRate = readRateOrNull(row[rateField]);
    if (actors === null || actorsWithStart === null) {
      continue;
    }
    if (actorsWithStart > actors || actorsWithStart > startActors) {
      blockers.push(`${blockerCode}_counts_inconsistent`);
      return;
    }
    if (
      coverageRate !== undefined &&
      !nullableNumbersMatch(coverageRate, ratio(actorsWithStart, startActors))
    ) {
      blockers.push(`${blockerCode}_rate_mismatch`);
      return;
    }
  }
}

function isSanitizedValidationFailureCode(code: string): boolean {
  if (isSessionFormValidationErrorCode(code)) {
    return true;
  }
  if (code === "unknown" || code === "unrecognized") {
    return true;
  }
  return /^unknown_code:[a-z0-9_.:-]{1,80}$/.test(code);
}

function validateReadiness(
  readiness: unknown,
  blockers: string[]
): void {
  if (!isRecord(readiness)) {
    blockers.push("readiness_invalid");
    return;
  }
  if (readiness.verdict !== "ready" && readiness.verdict !== "not-ready") {
    blockers.push("readiness_verdict_invalid");
  }
  if (typeof readiness.readyForPersonalizationEvaluation !== "boolean") {
    blockers.push("readiness_ready_for_personalization_invalid");
  }
  if (
    (readiness.verdict === "ready") !==
    readiness.readyForPersonalizationEvaluation
  ) {
    blockers.push("readiness_verdict_ready_mismatch");
  }
  validateReadinessCriteria(readiness.criteria, blockers);
  validateReadinessObserved(readiness.observed, blockers);
  validateStringArray(readiness.findings, "readiness_findings_invalid", blockers);
  validateFindingCodes(readiness.findingCodes, blockers);
}

function validateReadinessCriteria(
  criteria: unknown,
  blockers: string[]
): void {
  if (!isRecord(criteria)) {
    blockers.push("readiness_criteria_invalid");
    return;
  }
  for (const field of [
    "minRatedSessions",
    "minRatedSessionUsers",
    "minFiveRatedSessionUsers",
    "minFaceHeightTruthSessions",
  ] as const) {
    validateNonNegativeIntegerField(
      criteria[field],
      `readiness_criteria_${field}_invalid`,
      blockers
    );
  }
  for (const field of [
    "minBeachSelectedCoverage",
    "minConditionsSetCoverage",
    "minSubmitEventCoverage",
    "minRecentBuildMetadataCoverage",
  ] as const) {
    validateRate(
      criteria[field],
      `readiness_criteria_${field}_invalid`,
      blockers
    );
  }
  validateStringArray(
    criteria.expectedRecentClientBuilds,
    "readiness_criteria_expected_builds_invalid",
    blockers
  );
}

function validateReadinessObserved(
  observed: unknown,
  blockers: string[]
): void {
  if (!isRecord(observed)) {
    blockers.push("readiness_observed_invalid");
    return;
  }
  for (const field of [
    "ratedSessions",
    "ratedSessionUsers",
    "lifetimeScopedUsersWithFiveRatedSessions",
    "faceHeightTruthSessions",
    "ratedFaceHeightTruthSessions",
  ] as const) {
    validateNonNegativeIntegerField(
      observed[field],
      `readiness_observed_${field}_invalid`,
      blockers
    );
  }
  for (const field of [
    "beachSelectedCoverage",
    "conditionsSetCoverage",
    "submitEventCoverage",
    "recentBeachSelectedCoverage",
    "recentConditionsSetCoverage",
    "recentSubmitEventCoverage",
    "recentBuildMetadataCoverage",
  ] as const) {
    validateRateOrNull(
      observed[field],
      `readiness_observed_${field}_invalid`,
      blockers
    );
  }
  validateCountMap(
    observed.expectedRecentClientBuildStartActors,
    "readiness_observed_expected_builds_invalid",
    blockers
  );
}

function validateReadinessConsistency(
  report: Record<string, unknown>,
  blockers: string[]
): void {
  const readiness = report.readiness;
  if (!isRecord(readiness) || !isRecord(readiness.observed)) {
    return;
  }
  const observed = readiness.observed;
  const activation = isRecord(report.activation) ? report.activation : null;

  for (const [observedField, reportField] of [
    ["ratedSessions", "ratedSessions"],
    ["ratedSessionUsers", "ratedSessionUsers"],
    ["faceHeightTruthSessions", "faceHeightTruthSessions"],
    ["ratedFaceHeightTruthSessions", "ratedFaceHeightTruthSessions"],
  ] as const) {
    if (observed[observedField] !== report[reportField]) {
      blockers.push("readiness_observed_mismatch");
      break;
    }
  }

  if (
    activation &&
    observed.lifetimeScopedUsersWithFiveRatedSessions !==
      activation.lifetimeScopedUsersWithFiveRatedSessions
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const telemetryCoverage = isRecord(report.telemetryCoverage)
    ? report.telemetryCoverage
    : null;
  if (
    telemetryCoverage &&
    (!nullableNumbersMatch(
      observed.beachSelectedCoverage,
      readRateOrNull(telemetryCoverage.beachSelectedOfStart)
    ) ||
      !nullableNumbersMatch(
        observed.conditionsSetCoverage,
        readRateOrNull(telemetryCoverage.conditionsSetOfStart)
      ) ||
      !nullableNumbersMatch(
        observed.submitEventCoverage,
        readRateOrNull(telemetryCoverage.submitEventOfSavedSessionUsers)
      ))
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const recentTelemetry = isRecord(report.recentTelemetry)
    ? report.recentTelemetry
    : null;
  if (
    recentTelemetry &&
    (!nullableNumbersMatch(
      observed.recentBeachSelectedCoverage,
      readRateOrNull(recentTelemetry.beachSelectedOfStart)
    ) ||
      !nullableNumbersMatch(
        observed.recentConditionsSetCoverage,
        readRateOrNull(recentTelemetry.conditionsSetOfStart)
      ) ||
      !nullableNumbersMatch(
        observed.recentSubmitEventCoverage,
        readRateOrNull(recentTelemetry.submitEventOfStart)
      ) ||
      !nullableNumbersMatch(
        observed.recentBuildMetadataCoverage,
        getRecentBuildMetadataCoverage(recentTelemetry)
      ))
  ) {
    blockers.push("readiness_observed_mismatch");
  }

  const expectedBuildActors = getExpectedRecentClientBuildStartActors(report);
  if (
    expectedBuildActors &&
    !countMapsMatch(
      observed.expectedRecentClientBuildStartActors,
      expectedBuildActors
    )
  ) {
    blockers.push("readiness_observed_expected_builds_mismatch");
  }

  const expectedFindingCodes = getExpectedReadinessFindingCodes(report);
  if (expectedFindingCodes === null) {
    return;
  }
  const findingCodes = readiness.findingCodes;
  if (
    !Array.isArray(findingCodes) ||
    !stringArraysMatch(findingCodes, expectedFindingCodes)
  ) {
    blockers.push("readiness_finding_codes_mismatch");
  }

  const expectedReady = expectedFindingCodes.length === 0;
  if (readiness.readyForPersonalizationEvaluation !== expectedReady) {
    blockers.push("readiness_ready_for_personalization_mismatch");
  }
  if (readiness.verdict !== (expectedReady ? "ready" : "not-ready")) {
    blockers.push("readiness_verdict_mismatch");
  }
  if (
    (Array.isArray(readiness.findings) &&
      readiness.findings.length !== expectedFindingCodes.length) ||
    (Array.isArray(findingCodes) &&
      findingCodes.length !== expectedFindingCodes.length)
  ) {
    blockers.push("readiness_findings_mismatch");
  }
}

function getExpectedReadinessFindingCodes(
  report: Record<string, unknown>
): SessionAcquisitionReadinessFindingCode[] | null {
  if (
    !isRecord(report.readiness) ||
    !isRecord(report.readiness.criteria) ||
    !isRecord(report.activation) ||
    !isRecord(report.telemetryCoverage) ||
    !isRecord(report.recentTelemetry)
  ) {
    return null;
  }
  const criteria = report.readiness.criteria;
  const ratedSessions = readNonNegativeInteger(report.ratedSessions);
  const ratedSessionUsers = readNonNegativeInteger(report.ratedSessionUsers);
  const lifetimeFiveRatedUsers = readNonNegativeInteger(
    report.activation.lifetimeScopedUsersWithFiveRatedSessions
  );
  const ratedFaceHeightTruthSessions = readNonNegativeInteger(
    report.ratedFaceHeightTruthSessions
  );
  const minRatedSessions = readNonNegativeInteger(criteria.minRatedSessions);
  const minRatedSessionUsers = readNonNegativeInteger(
    criteria.minRatedSessionUsers
  );
  const minFiveRatedSessionUsers = readNonNegativeInteger(
    criteria.minFiveRatedSessionUsers
  );
  const minFaceHeightTruthSessions = readNonNegativeInteger(
    criteria.minFaceHeightTruthSessions
  );
  const minBeachSelectedCoverage = readRate(criteria.minBeachSelectedCoverage);
  const minConditionsSetCoverage = readRate(criteria.minConditionsSetCoverage);
  const minSubmitEventCoverage = readRate(criteria.minSubmitEventCoverage);
  const minRecentBuildMetadataCoverage = readRate(
    criteria.minRecentBuildMetadataCoverage
  );
  const beachSelectedCoverage = readRateOrNull(
    report.telemetryCoverage.beachSelectedOfStart
  );
  const conditionsSetCoverage = readRateOrNull(
    report.telemetryCoverage.conditionsSetOfStart
  );
  const submitEventCoverage = readRateOrNull(
    report.telemetryCoverage.submitEventOfSavedSessionUsers
  );
  const recentBeachSelectedCoverage = readRateOrNull(
    report.recentTelemetry.beachSelectedOfStart
  );
  const recentConditionsSetCoverage = readRateOrNull(
    report.recentTelemetry.conditionsSetOfStart
  );
  const recentSubmitEventCoverage = readRateOrNull(
    report.recentTelemetry.submitEventOfStart
  );
  const recentBuildMetadataCoverage = getRecentBuildMetadataCoverage(
    report.recentTelemetry
  );
  const expectedBuildActors = getExpectedRecentClientBuildStartActors(report);

  if (
    ratedSessions === null ||
    ratedSessionUsers === null ||
    lifetimeFiveRatedUsers === null ||
    ratedFaceHeightTruthSessions === null ||
    minRatedSessions === null ||
    minRatedSessionUsers === null ||
    minFiveRatedSessionUsers === null ||
    minFaceHeightTruthSessions === null ||
    minBeachSelectedCoverage === null ||
    minConditionsSetCoverage === null ||
    minSubmitEventCoverage === null ||
    minRecentBuildMetadataCoverage === null ||
    beachSelectedCoverage === undefined ||
    conditionsSetCoverage === undefined ||
    submitEventCoverage === undefined ||
    recentBeachSelectedCoverage === undefined ||
    recentConditionsSetCoverage === undefined ||
    recentSubmitEventCoverage === undefined ||
    recentBuildMetadataCoverage === undefined ||
    expectedBuildActors === null
  ) {
    return null;
  }

  const findingCodes: SessionAcquisitionReadinessFindingCode[] = [];
  if (ratedSessions < minRatedSessions) {
    findingCodes.push("rated_sessions_floor");
  }
  if (ratedSessionUsers < minRatedSessionUsers) {
    findingCodes.push("rated_session_users_floor");
  }
  if (lifetimeFiveRatedUsers < minFiveRatedSessionUsers) {
    findingCodes.push("five_rated_session_users_floor");
  }
  if (ratedFaceHeightTruthSessions < minFaceHeightTruthSessions) {
    findingCodes.push("rated_face_height_truth_sessions_floor");
  }
  if (
    beachSelectedCoverage === null ||
    beachSelectedCoverage < minBeachSelectedCoverage
  ) {
    findingCodes.push("beach_selected_coverage_floor");
  }
  if (
    conditionsSetCoverage === null ||
    conditionsSetCoverage < minConditionsSetCoverage
  ) {
    findingCodes.push("conditions_set_coverage_floor");
  }
  if (
    submitEventCoverage === null ||
    submitEventCoverage < minSubmitEventCoverage
  ) {
    findingCodes.push("submit_event_coverage_floor");
  }

  const hasNarrowRecentTelemetryWindow =
    isUtcTimestamp(report.recentTelemetry.start) &&
    isUtcTimestamp(report.start) &&
    Date.parse(report.recentTelemetry.start) > Date.parse(report.start);
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentBeachSelectedCoverage === null ||
      recentBeachSelectedCoverage < minBeachSelectedCoverage)
  ) {
    findingCodes.push("recent_beach_selected_coverage_floor");
  }
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentConditionsSetCoverage === null ||
      recentConditionsSetCoverage < minConditionsSetCoverage)
  ) {
    findingCodes.push("recent_conditions_set_coverage_floor");
  }
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentSubmitEventCoverage === null ||
      recentSubmitEventCoverage < minSubmitEventCoverage)
  ) {
    findingCodes.push("recent_submit_event_coverage_floor");
  }
  if (
    recentBuildMetadataCoverage === null ||
    recentBuildMetadataCoverage < minRecentBuildMetadataCoverage
  ) {
    findingCodes.push("recent_build_metadata_coverage_floor");
  }
  for (const startActors of Object.values(expectedBuildActors)) {
    if (startActors === 0) {
      findingCodes.push("expected_recent_client_build_missing");
    }
  }

  return findingCodes;
}

function getRecentBuildMetadataCoverage(
  recentTelemetry: Record<string, unknown>
): number | null | undefined {
  const startActors = readNonNegativeInteger(recentTelemetry.startActors);
  const startActorsWithoutBuildMetadata = readNonNegativeInteger(
    recentTelemetry.startActorsWithoutBuildMetadata
  );
  if (startActors === null || startActorsWithoutBuildMetadata === null) {
    return undefined;
  }
  return ratio(startActors - startActorsWithoutBuildMetadata, startActors);
}

function getExpectedRecentClientBuildStartActors(
  report: Record<string, unknown>
): Record<string, number> | null {
  if (
    !isRecord(report.readiness) ||
    !isRecord(report.readiness.criteria) ||
    !isRecord(report.recentTelemetry)
  ) {
    return null;
  }
  const expectedRecentClientBuilds =
    report.readiness.criteria.expectedRecentClientBuilds;
  const telemetryCoverageByClientBuild =
    report.recentTelemetry.telemetryCoverageByClientBuild;
  if (
    !Array.isArray(expectedRecentClientBuilds) ||
    expectedRecentClientBuilds.some((clientBuild) => typeof clientBuild !== "string") ||
    !Array.isArray(telemetryCoverageByClientBuild)
  ) {
    return null;
  }

  const startsByClientBuild = new Map<string, number>();
  for (const row of telemetryCoverageByClientBuild) {
    if (
      isRecord(row) &&
      typeof row.clientBuild === "string" &&
      isNonNegativeIntegerValue(row.startActors)
    ) {
      startsByClientBuild.set(row.clientBuild, row.startActors);
    }
  }

  return Object.fromEntries(
    expectedRecentClientBuilds.map((clientBuild) => [
      clientBuild,
      startsByClientBuild.get(clientBuild) ?? 0,
    ])
  );
}

function validateCountMap(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isRecord(value)) {
    blockers.push(blockerCode);
    return;
  }
  for (const count of Object.values(value)) {
    if (!isNonNegativeIntegerValue(count)) {
      blockers.push(blockerCode);
      return;
    }
  }
}

function validatePlatformCountMap(
  value: unknown,
  blockerCode: string,
  labelBlockerCode: string,
  blockers: string[]
): void {
  validateCountMap(value, blockerCode, blockers);
  if (!isRecord(value)) return;
  if (Object.keys(value).some((platform) => !isSafePlatformLabel(platform))) {
    blockers.push(labelBlockerCode);
  }
}

function sumCountMap(value: Record<string, unknown>): number {
  return Object.values(value).reduce<number>((sum, count) => {
    if (typeof count !== "number" || !Number.isFinite(count)) {
      return sum;
    }
    return sum + count;
  }, 0);
}

function validateStringArray(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    blockers.push(blockerCode);
  }
}

function validateFindingCodes(value: unknown, blockers: string[]): void {
  const allowedCodes: readonly string[] = [
    "rated_sessions_floor",
    "rated_session_users_floor",
    "five_rated_session_users_floor",
    "rated_face_height_truth_sessions_floor",
    "beach_selected_coverage_floor",
    "conditions_set_coverage_floor",
    "submit_event_coverage_floor",
    "recent_beach_selected_coverage_floor",
    "recent_conditions_set_coverage_floor",
    "recent_submit_event_coverage_floor",
    "recent_build_metadata_coverage_floor",
    "expected_recent_client_build_missing",
  ];
  if (
    !Array.isArray(value) ||
    value.some(
      (code) => typeof code !== "string" || !allowedCodes.includes(code)
    )
  ) {
    blockers.push("readiness_finding_codes_invalid");
  }
}

function validateUtcTimestampField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isUtcTimestamp(value)) {
    blockers.push(blockerCode);
  }
}

function validateNonNegativeIntegerField(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (!isNonNegativeIntegerValue(value)) {
    blockers.push(blockerCode);
  }
}

function validateRate(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (readRate(value) === null) {
    blockers.push(blockerCode);
  }
}

function validateRateOrNull(
  value: unknown,
  blockerCode: string,
  blockers: string[]
): void {
  if (value !== null) {
    validateRate(value, blockerCode, blockers);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeIntegerValue(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function readNonNegativeInteger(value: unknown): number | null {
  return isNonNegativeIntegerValue(value) ? value : null;
}

function readRate(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}

function readRateOrNull(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return readRate(value) ?? undefined;
}

function nullableNumbersMatch(
  actual: unknown,
  expected: number | null | undefined
): boolean {
  if (expected === undefined) {
    return true;
  }
  if (actual === null || expected === null) {
    return actual === expected;
  }
  return (
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    Math.abs(actual - expected) < 0.000_000_001
  );
}

function exactNullableNumbersMatch(
  actual: unknown,
  expected: number | null
): boolean {
  if (actual === null || expected === null) {
    return actual === expected;
  }
  return (
    typeof actual === "number" && Number.isFinite(actual) && actual === expected
  );
}

function countMapsMatch(
  actual: unknown,
  expected: Record<string, number>
): boolean {
  if (!isRecord(actual)) {
    return false;
  }
  const actualEntries = Object.entries(actual);
  const expectedEntries = Object.entries(expected);
  return (
    actualEntries.length === expectedEntries.length &&
    expectedEntries.every(([key, value]) => actual[key] === value)
  );
}

function stringArraysMatch(
  actual: unknown[],
  expected: readonly string[]
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function printUsage(): void {
  console.log(`Usage:
  yarn tsx scripts/session-acquisition-funnel-report.ts --days 30
  yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --output-json /tmp/quiver-session-acquisition-funnel-report.json
  yarn tsx scripts/session-acquisition-funnel-report.ts --start 2026-06-01 --end 2026-07-01
  yarn tsx scripts/session-acquisition-funnel-report.ts --days 30 --recent-telemetry-days 7 --min-rated-sessions 100 --min-rated-session-users 25 --min-five-rated-session-users 25 --min-conditions-set-coverage 0.8 --min-submit-event-coverage 0.8 --min-recent-build-metadata-coverage 0.8 --fail-on-not-ready
  yarn tsx scripts/session-acquisition-funnel-report.ts --validate-output-json /tmp/quiver-session-acquisition-funnel-report.json --max-report-age-hours 24`);
}

function createAdminClient(): AdminClient {
  const supabaseUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    ""
  ).trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function fetchEventRows(
  supabase: AdminClient,
  options: CliOptions
): Promise<SessionAcquisitionEventRow[]> {
  const rows: SessionAcquisitionEventRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase
      .from("user_events")
      .select("user_id, session_id, event_type, created_at, metadata, bot_flagged")
      .gte("created_at", options.start)
      .lt("created_at", options.end)
      .in("event_type", Array.from(SESSION_ACQUISITION_EVENT_TYPES));
    const { data, error } = await applyStablePaginationOrder(query)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch user_events: ${error.message}`);
    const page = (data ?? []) as unknown as SessionAcquisitionEventRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchWindowSessionRows(
  supabase: AdminClient,
  options: CliOptions
): Promise<SessionAcquisitionSessionRow[]> {
  const rows: SessionAcquisitionSessionRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase
      .from("sessions")
      .select(
        "id, user_id, created_at, arrival_time, status, source, rating, wave_height_ft, deleted_at"
      )
      .gte("created_at", options.start)
      .lt("created_at", options.end);
    const { data, error } = await applyStablePaginationOrder(query)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch sessions: ${error.message}`);
    const page = (data ?? []) as unknown as SessionAcquisitionSessionRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchProfilesCreatedInWindow(
  supabase: AdminClient,
  options: CliOptions
): Promise<SessionAcquisitionProfileRow[]> {
  const rows: SessionAcquisitionProfileRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase
      .from("profiles")
      .select(profileSelect())
      .gte("created_at", options.start)
      .lt("created_at", options.end);
    const { data, error } = await applyStablePaginationOrder(query)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
    const page = (data ?? []) as unknown as SessionAcquisitionProfileRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchProfilesForUsers(
  supabase: AdminClient,
  userIds: string[]
): Promise<SessionAcquisitionProfileRow[]> {
  if (userIds.length === 0) return [];

  const rows: SessionAcquisitionProfileRow[] = [];
  for (const chunk of chunks(userIds, 200)) {
    const { data, error } = await supabase
      .from("profiles")
      .select(profileSelect())
      .in("id", chunk);

    if (error) throw new Error(`Failed to fetch scoped profiles: ${error.message}`);
    rows.push(...((data ?? []) as unknown as SessionAcquisitionProfileRow[]));
  }
  return rows;
}

async function fetchLifetimeSessionsForUsers(
  supabase: AdminClient,
  userIds: string[],
  end: string
): Promise<SessionAcquisitionSessionRow[]> {
  if (userIds.length === 0) return [];

  const rows: SessionAcquisitionSessionRow[] = [];
  for (const chunk of chunks(userIds, 200)) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const query = supabase
        .from("sessions")
        .select(
          "id, user_id, created_at, arrival_time, status, source, rating, wave_height_ft, deleted_at"
        )
        .lt("created_at", end)
        .in("user_id", chunk);
      const { data, error } = await applyStablePaginationOrder(query)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch lifetime sessions: ${error.message}`);
      }
      const page = (data ?? []) as unknown as SessionAcquisitionSessionRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
  }
  return rows;
}

export async function readSessionAcquisitionSourceRows(
  supabase: AdminClient,
  options: CliOptions
): Promise<SessionAcquisitionSourceRows> {
  const [events, windowSessions, profilesCreatedInWindow] = await Promise.all([
    fetchEventRows(supabase, options),
    fetchWindowSessionRows(supabase, options),
    fetchProfilesCreatedInWindow(supabase, options),
  ]);

  const scopedUserIds = Array.from(
    new Set(
      [
        ...events.flatMap((event) => (event.user_id ? [event.user_id] : [])),
        ...windowSessions.map((session) => session.user_id),
        ...profilesCreatedInWindow.map((profile) => profile.id),
      ].sort()
    )
  );
  const [scopedProfiles, lifetimeSessions] = await Promise.all([
    fetchProfilesForUsers(supabase, scopedUserIds),
    fetchLifetimeSessionsForUsers(supabase, scopedUserIds, options.end),
  ]);

  const profilesById = new Map<string, SessionAcquisitionProfileRow>();
  for (const profile of [...profilesCreatedInWindow, ...scopedProfiles]) {
    profilesById.set(profile.id, profile);
  }

  return {
    events,
    windowSessions,
    lifetimeSessions,
    profiles: Array.from(profilesById.values()),
  };
}

function profileSelect(): string {
  return [
    "id",
    "created_at",
    "deleted_at",
    "onboarding_completed_at",
    "experience_level",
    "activity_level",
    "home_beach_id",
    "surf_styles",
    "preferred_session_time",
    "timezone",
    "is_mock",
    "analytics_is_real_user",
    "is_system_account",
    "analytics_exclusion_reason",
  ].join(", ");
}

export function applyStablePaginationOrder<
  TQuery extends {
    order(
      column: string,
      options: { ascending: boolean }
    ): TQuery;
  },
>(query: TQuery): TQuery {
  return query
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
}

function buildEventActorsByType(
  events: SessionAcquisitionEventRow[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const event of events) {
    const actor = actorKeyForEvent(event);
    if (!actor) continue;
    const actors = map.get(event.event_type) ?? new Set<string>();
    actors.add(actor);
    map.set(event.event_type, actors);
  }
  return map;
}

function buildEventActorsByTypeAndPlatform(
  events: SessionAcquisitionEventRow[]
): PlatformActorMap {
  const map: PlatformActorMap = new Map();
  for (const event of events) {
    const actor = actorKeyForEvent(event);
    if (!actor) continue;

    const platform = platformForEvent(event);
    const platformMap = map.get(event.event_type) ?? new Map<string, Set<string>>();
    const actors = platformMap.get(platform) ?? new Set<string>();
    actors.add(actor);
    platformMap.set(platform, actors);
    map.set(event.event_type, platformMap);
  }
  return map;
}

function buildEventActorsByTypeAndClientBuild(
  events: SessionAcquisitionEventRow[]
): ClientBuildActorMap {
  const map: ClientBuildActorMap = new Map();
  for (const event of events) {
    const actor = actorKeyForEvent(event);
    if (!actor) continue;

    const clientBuild = clientBuildForEvent(event).clientBuild;
    const buildMap = map.get(event.event_type) ?? new Map<string, Set<string>>();
    const actors = buildMap.get(clientBuild) ?? new Set<string>();
    actors.add(actor);
    buildMap.set(clientBuild, actors);
    map.set(event.event_type, buildMap);
  }
  return map;
}

function buildTelemetryCoverageByPlatform(
  eventActorsByTypeAndPlatform: PlatformActorMap
): SessionTelemetryPlatformCoverage[] {
  const platforms = new Set<string>();
  for (const eventType of [
    "session_log_start",
    "session_log_form_view",
    "session_log_beach_selected",
    "session_log_conditions_set",
    "session_log_submit",
  ]) {
    for (const platform of eventActorsByTypeAndPlatform.get(eventType)?.keys() ?? []) {
      platforms.add(platform);
    }
  }

  return Array.from(platforms)
    .map((platform) => {
      const startActors = platformActors(
        eventActorsByTypeAndPlatform,
        "session_log_start",
        platform
      );
      const formViewActors = platformActors(
        eventActorsByTypeAndPlatform,
        "session_log_form_view",
        platform
      );
      const beachSelectedActors = platformActors(
        eventActorsByTypeAndPlatform,
        "session_log_beach_selected",
        platform
      );
      const conditionsSetActors = platformActors(
        eventActorsByTypeAndPlatform,
        "session_log_conditions_set",
        platform
      );
      const submitEventActors = platformActors(
        eventActorsByTypeAndPlatform,
        "session_log_submit",
        platform
      );
      const formViewActorsWithStart = intersectionSize(
        formViewActors,
        startActors
      );
      const beachSelectedActorsWithStart = intersectionSize(
        beachSelectedActors,
        startActors
      );
      const conditionsSetActorsWithStart = intersectionSize(
        conditionsSetActors,
        startActors
      );
      const submitActorsWithStart = intersectionSize(
        submitEventActors,
        startActors
      );

      return {
        platform,
        startActors: startActors.size,
        formViewActors: formViewActors.size,
        formViewActorsWithStart,
        formViewOfStart: ratio(formViewActorsWithStart, startActors.size),
        beachSelectedActors: beachSelectedActors.size,
        beachSelectedActorsWithStart,
        beachSelectedOfStart: ratio(
          beachSelectedActorsWithStart,
          startActors.size
        ),
        conditionsSetActors: conditionsSetActors.size,
        conditionsSetActorsWithStart,
        conditionsSetOfStart: ratio(
          conditionsSetActorsWithStart,
          startActors.size
        ),
        submitEventActors: submitEventActors.size,
        submitActorsWithStart,
        submitEventOfStart: ratio(submitActorsWithStart, startActors.size),
      };
    })
    .sort(
      (a, b) =>
        b.startActors - a.startActors ||
        b.beachSelectedActorsWithStart - a.beachSelectedActorsWithStart ||
        a.platform.localeCompare(b.platform)
    );
}

function buildTelemetryCoverageByClientBuild(
  eventActorsByTypeAndClientBuild: ClientBuildActorMap
): SessionTelemetryClientBuildCoverage[] {
  const startBuilds =
    eventActorsByTypeAndClientBuild.get("session_log_start")?.keys() ?? [];

  return Array.from(startBuilds)
    .map((clientBuild) => {
      const startActors = clientBuildActors(
        eventActorsByTypeAndClientBuild,
        "session_log_start",
        clientBuild
      );
      const formViewActors = clientBuildActors(
        eventActorsByTypeAndClientBuild,
        "session_log_form_view",
        clientBuild
      );
      const beachSelectedActors = clientBuildActors(
        eventActorsByTypeAndClientBuild,
        "session_log_beach_selected",
        clientBuild
      );
      const conditionsSetActors = clientBuildActors(
        eventActorsByTypeAndClientBuild,
        "session_log_conditions_set",
        clientBuild
      );
      const submitEventActors = clientBuildActors(
        eventActorsByTypeAndClientBuild,
        "session_log_submit",
        clientBuild
      );
      const formViewActorsWithStart = intersectionSize(
        formViewActors,
        startActors
      );
      const beachSelectedActorsWithStart = intersectionSize(
        beachSelectedActors,
        startActors
      );
      const conditionsSetActorsWithStart = intersectionSize(
        conditionsSetActors,
        startActors
      );
      const submitActorsWithStart = intersectionSize(
        submitEventActors,
        startActors
      );
      const identity = parseClientBuildLabel(clientBuild);

      return {
        clientBuild,
        hasVersionMetadata: identity.appVersion !== "unknown-version",
        hasBuildMetadata: identity.appBuild !== "unknown-build",
        startActors: startActors.size,
        formViewActors: formViewActors.size,
        formViewActorsWithStart,
        formViewOfStart: ratio(formViewActorsWithStart, startActors.size),
        beachSelectedActors: beachSelectedActors.size,
        beachSelectedActorsWithStart,
        beachSelectedOfStart: ratio(
          beachSelectedActorsWithStart,
          startActors.size
        ),
        conditionsSetActors: conditionsSetActors.size,
        conditionsSetActorsWithStart,
        conditionsSetOfStart: ratio(
          conditionsSetActorsWithStart,
          startActors.size
        ),
        submitEventActors: submitEventActors.size,
        submitActorsWithStart,
        submitEventOfStart: ratio(submitActorsWithStart, startActors.size),
      };
    })
    .sort(
      (a, b) =>
        b.startActors - a.startActors ||
        Number(b.hasVersionMetadata && b.hasBuildMetadata) -
          Number(a.hasVersionMetadata && a.hasBuildMetadata) ||
        a.clientBuild.localeCompare(b.clientBuild)
    );
}

function buildRecentTelemetryWindow(
  events: SessionAcquisitionEventRow[],
  start: string,
  end: string,
  recentTelemetryDays: number
): SessionRecentTelemetryWindow {
  const endMs = Date.parse(end);
  const startMs = Math.max(
    Date.parse(start),
    endMs - recentTelemetryDays * MS_PER_DAY
  );
  const recentStart = new Date(startMs).toISOString();
  const recentEvents = events.filter((event) =>
    timestampInRange(event.created_at, recentStart, end)
  );
  const eventActorsByType = buildEventActorsByType(recentEvents);
  const eventActorsByTypeAndPlatform =
    buildEventActorsByTypeAndPlatform(recentEvents);
  const eventActorsByTypeAndClientBuild =
    buildEventActorsByTypeAndClientBuild(recentEvents);
  const startActors = eventActorsByType.get("session_log_start") ?? new Set();
  const formViewActors =
    eventActorsByType.get("session_log_form_view") ?? new Set();
  const beachSelectedActors =
    eventActorsByType.get("session_log_beach_selected") ?? new Set();
  const conditionsSetActors =
    eventActorsByType.get("session_log_conditions_set") ?? new Set();
  const submitEventActors =
    eventActorsByType.get("session_log_submit") ?? new Set();
  const startActorsWithoutBuildMetadata =
    countStartActorsWithoutBuildMetadata(recentEvents);
  const formViewActorsWithStart = intersectionSize(formViewActors, startActors);
  const beachSelectedActorsWithStart = intersectionSize(
    beachSelectedActors,
    startActors
  );
  const conditionsSetActorsWithStart = intersectionSize(
    conditionsSetActors,
    startActors
  );
  const submitActorsWithStart = intersectionSize(submitEventActors, startActors);

  return {
    start: recentStart,
    end,
    days: Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY)),
    eventRows: recentEvents.length,
    startActors: startActors.size,
    startActorsWithoutBuildMetadata,
    formViewActors: formViewActors.size,
    formViewActorsWithStart,
    formViewOfStart: ratio(formViewActorsWithStart, startActors.size),
    beachSelectedActors: beachSelectedActors.size,
    beachSelectedActorsWithStart,
    beachSelectedOfStart: ratio(beachSelectedActorsWithStart, startActors.size),
    conditionsSetActors: conditionsSetActors.size,
    conditionsSetActorsWithStart,
    conditionsSetOfStart: ratio(conditionsSetActorsWithStart, startActors.size),
    submitEventActors: submitEventActors.size,
    submitActorsWithStart,
    submitEventOfStart: ratio(submitActorsWithStart, startActors.size),
    telemetryCoverageByPlatform: buildTelemetryCoverageByPlatform(
      eventActorsByTypeAndPlatform
    ),
    telemetryCoverageByClientBuild: buildTelemetryCoverageByClientBuild(
      eventActorsByTypeAndClientBuild
    ),
    validationFailuresByCode: buildValidationFailuresByCode(
      recentEvents.filter(
        (event) => event.event_type === "session_log_validation_failed"
      )
    ),
  };
}

function buildValidationFailuresByCode(
  events: SessionAcquisitionEventRow[]
): SessionValidationFailureMetric[] {
  const byCode = new Map<
    string,
    {
      events: number;
      actors: Set<string>;
      platforms: Record<string, number>;
    }
  >();

  for (const event of events) {
    const actor = actorKeyForEvent(event);
    const platform = platformForEvent(event);
    for (const code of extractValidationErrorCodes(event.metadata)) {
      const entry =
        byCode.get(code) ??
        {
          events: 0,
          actors: new Set<string>(),
          platforms: {},
        };
      entry.events += 1;
      if (actor) entry.actors.add(actor);
      entry.platforms[platform] = (entry.platforms[platform] ?? 0) + 1;
      byCode.set(code, entry);
    }
  }

  return Array.from(byCode.entries())
    .map(([code, entry]) => ({
      code,
      events: entry.events,
      actors: entry.actors.size,
      platforms: sortCountRecord(entry.platforms),
    }))
    .sort(
      (a, b) =>
        b.actors - a.actors ||
        b.events - a.events ||
        a.code.localeCompare(b.code)
  );
}

function countStartActorsWithoutBuildMetadata(
  events: SessionAcquisitionEventRow[]
): number {
  const actors = new Set<string>();
  for (const event of events) {
    if (event.event_type !== "session_log_start") continue;
    const actor = actorKeyForEvent(event);
    if (!actor) continue;

    const identity = clientBuildForEvent(event);
    if (
      identity.appVersion === "unknown-version" ||
      identity.appBuild === "unknown-build"
    ) {
      actors.add(actor);
    }
  }
  return actors.size;
}

function platformActors(
  eventActorsByTypeAndPlatform: PlatformActorMap,
  eventType: string,
  platform: string
): Set<string> {
  return eventActorsByTypeAndPlatform.get(eventType)?.get(platform) ?? new Set();
}

function clientBuildActors(
  eventActorsByTypeAndClientBuild: ClientBuildActorMap,
  eventType: string,
  clientBuild: string
): Set<string> {
  return (
    eventActorsByTypeAndClientBuild.get(eventType)?.get(clientBuild) ??
    new Set()
  );
}

function buildFunnelSteps(
  inputs: Array<{ key: string; label: string; actors: Set<string> }>,
  startActors: Set<string>
): FunnelStepMetric[] {
  return inputs.map((input, index) => {
    const previousActors = index === 0 ? null : inputs[index - 1].actors;
    return {
      key: input.key,
      label: input.label,
      actors: input.actors.size,
      actorsWithStart:
        index === 0 ? input.actors.size : intersectionSize(input.actors, startActors),
      pctOfStart:
        index === 0
          ? input.actors.size > 0
            ? 1
            : null
          : ratio(intersectionSize(input.actors, startActors), startActors.size),
      pctOfPrevious: previousActors
        ? ratio(intersectionSize(input.actors, previousActors), previousActors.size)
        : null,
    };
  });
}

function computeActivationSummary(
  windowRatedSessions: SessionAcquisitionSessionRow[],
  lifetimeSessions: SessionAcquisitionSessionRow[]
): ActivationSummary {
  const windowCounts = countRatedSessionsByUser(windowRatedSessions);
  const lifetimeRatedSessions = lifetimeSessions
    .filter(isCompletedSession)
    .filter(hasRating);
  const lifetimeCounts = countRatedSessionsByUser(lifetimeRatedSessions);
  const timeToFifth = computeTimeToNthRatedSession(lifetimeRatedSessions, 5);

  return {
    windowUsersWithRatedSession: countUsersAtThreshold(windowCounts, 1),
    windowUsersWithThreeRatedSessions: countUsersAtThreshold(windowCounts, 3),
    windowUsersWithFiveRatedSessions: countUsersAtThreshold(windowCounts, 5),
    lifetimeScopedUsersWithFiveRatedSessions: countUsersAtThreshold(
      lifetimeCounts,
      5
    ),
    medianDaysToFifthRating: median(timeToFifth),
    p75DaysToFifthRating: percentile(timeToFifth, 0.75),
  };
}

export function computeTimeToNthRatedSession(
  ratedSessions: SessionAcquisitionSessionRow[],
  nth: number
): number[] {
  const byUser = new Map<string, SessionAcquisitionSessionRow[]>();
  for (const session of ratedSessions) {
    const sessions = byUser.get(session.user_id) ?? [];
    sessions.push(session);
    byUser.set(session.user_id, sessions);
  }

  const durations: number[] = [];
  for (const sessions of byUser.values()) {
    sessions.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    if (sessions.length < nth) continue;
    const first = Date.parse(sessions[0].created_at);
    const nthDate = Date.parse(sessions[nth - 1].created_at);
    durations.push((nthDate - first) / MS_PER_DAY);
  }
  return durations.sort((a, b) => a - b);
}

function computeOnboardingSummary(
  profiles: SessionAcquisitionProfileRow[]
): OnboardingSummary {
  return {
    newProfiles: profiles.length,
    completedOnboarding: profiles.filter(
      (profile) => profile.onboarding_completed_at !== null
    ).length,
    withHomeBeach: profiles.filter((profile) => profile.home_beach_id !== null)
      .length,
    withExperienceLevel: profiles.filter(
      (profile) => profile.experience_level !== null
    ).length,
    withActivityLevel: profiles.filter((profile) => profile.activity_level !== null)
      .length,
    withSurfStyles: profiles.filter(
      (profile) => (profile.surf_styles?.length ?? 0) > 0
    ).length,
    withPreferredSessionTime: profiles.filter(
      (profile) => profile.preferred_session_time !== null
    ).length,
    withTimezone: profiles.filter((profile) => profile.timezone !== null).length,
  };
}

export function buildSessionAcquisitionReadiness(
  report: Omit<SessionAcquisitionReport, "readiness">,
  criteria: SessionAcquisitionReadinessCriteria =
    defaultSessionAcquisitionReadinessCriteria()
): SessionAcquisitionReadiness {
  const beachSelectedCoverage = report.telemetryCoverage.beachSelectedOfStart;
  const conditionsSetCoverage = report.telemetryCoverage.conditionsSetOfStart;
  const submitEventCoverage =
    report.telemetryCoverage.submitEventOfSavedSessionUsers;
  const recentBeachSelectedCoverage = report.recentTelemetry.beachSelectedOfStart;
  const recentConditionsSetCoverage = report.recentTelemetry.conditionsSetOfStart;
  const recentSubmitEventCoverage = report.recentTelemetry.submitEventOfStart;
  const recentBuildMetadataCoverage = ratio(
    report.recentTelemetry.startActors -
      report.recentTelemetry.startActorsWithoutBuildMetadata,
    report.recentTelemetry.startActors
  );
  const expectedRecentClientBuildStartActors =
    buildExpectedRecentClientBuildStartActors(
      report.recentTelemetry,
      criteria.expectedRecentClientBuilds ?? []
    );
  const hasNarrowRecentTelemetryWindow =
    Date.parse(report.recentTelemetry.start) > Date.parse(report.start);
  const findings: SessionAcquisitionReadinessFinding[] = [];

  if (report.ratedSessions < criteria.minRatedSessions) {
    findings.push({
      code: "rated_sessions_floor",
      message: `Rated sessions are below the ${criteria.minRatedSessions.toLocaleString()}-session floor.`,
    });
  }
  if (report.ratedSessionUsers < criteria.minRatedSessionUsers) {
    findings.push({
      code: "rated_session_users_floor",
      message: `Rated-session users are below the ${criteria.minRatedSessionUsers.toLocaleString()}-user floor.`,
    });
  }
  if (
    report.activation.lifetimeScopedUsersWithFiveRatedSessions <
    criteria.minFiveRatedSessionUsers
  ) {
    findings.push({
      code: "five_rated_session_users_floor",
      message: `Users with 5+ rated sessions are below the ${criteria.minFiveRatedSessionUsers.toLocaleString()}-user floor.`,
    });
  }
  if (
    report.ratedFaceHeightTruthSessions < criteria.minFaceHeightTruthSessions
  ) {
    findings.push({
      code: "rated_face_height_truth_sessions_floor",
      message: `Rated face-height truth sessions are below the ${criteria.minFaceHeightTruthSessions.toLocaleString()}-session floor.`,
    });
  }
  if (
    beachSelectedCoverage === null ||
    beachSelectedCoverage < criteria.minBeachSelectedCoverage
  ) {
    findings.push({
      code: "beach_selected_coverage_floor",
      message: `Beach-selected event coverage is below ${formatPercent(
        criteria.minBeachSelectedCoverage
      )}.`,
    });
  }
  if (
    conditionsSetCoverage === null ||
    conditionsSetCoverage < criteria.minConditionsSetCoverage
  ) {
    findings.push({
      code: "conditions_set_coverage_floor",
      message: `Conditions-set event coverage is below ${formatPercent(
        criteria.minConditionsSetCoverage
      )}.`,
    });
  }
  if (
    submitEventCoverage === null ||
    submitEventCoverage < criteria.minSubmitEventCoverage
  ) {
    findings.push({
      code: "submit_event_coverage_floor",
      message: `Submit-event coverage is below ${formatPercent(
        criteria.minSubmitEventCoverage
      )}.`,
    });
  }
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentBeachSelectedCoverage === null ||
      recentBeachSelectedCoverage < criteria.minBeachSelectedCoverage)
  ) {
    findings.push({
      code: "recent_beach_selected_coverage_floor",
      message: `Recent ${report.recentTelemetry.days}-day beach-selected event coverage is below ${formatPercent(
        criteria.minBeachSelectedCoverage
      )}.`,
    });
  }
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentConditionsSetCoverage === null ||
      recentConditionsSetCoverage < criteria.minConditionsSetCoverage)
  ) {
    findings.push({
      code: "recent_conditions_set_coverage_floor",
      message: `Recent ${report.recentTelemetry.days}-day conditions-set event coverage is below ${formatPercent(
        criteria.minConditionsSetCoverage
      )}.`,
    });
  }
  if (
    hasNarrowRecentTelemetryWindow &&
    (recentSubmitEventCoverage === null ||
      recentSubmitEventCoverage < criteria.minSubmitEventCoverage)
  ) {
    findings.push({
      code: "recent_submit_event_coverage_floor",
      message: `Recent ${report.recentTelemetry.days}-day submit-event coverage is below ${formatPercent(
        criteria.minSubmitEventCoverage
      )}.`,
    });
  }
  if (
    recentBuildMetadataCoverage === null ||
    recentBuildMetadataCoverage < criteria.minRecentBuildMetadataCoverage
  ) {
    findings.push({
      code: "recent_build_metadata_coverage_floor",
      message: `Recent app version/build metadata coverage is below ${formatPercent(
        criteria.minRecentBuildMetadataCoverage
      )}.`,
    });
  }
  for (const [clientBuild, startActors] of Object.entries(
    expectedRecentClientBuildStartActors
  )) {
    if (startActors === 0) {
      findings.push({
        code: "expected_recent_client_build_missing",
        message: `Expected recent client build ${clientBuild} has no session-log start actors.`,
      });
    }
  }

  const readyForPersonalizationEvaluation = findings.length === 0;
  const findingMessages = findings.map((finding) => finding.message);
  const findingCodes = findings.map((finding) => finding.code);
  return {
    verdict: readyForPersonalizationEvaluation ? "ready" : "not-ready",
    readyForPersonalizationEvaluation,
    criteria,
    observed: {
      ratedSessions: report.ratedSessions,
      ratedSessionUsers: report.ratedSessionUsers,
      lifetimeScopedUsersWithFiveRatedSessions:
        report.activation.lifetimeScopedUsersWithFiveRatedSessions,
      faceHeightTruthSessions: report.faceHeightTruthSessions,
      ratedFaceHeightTruthSessions: report.ratedFaceHeightTruthSessions,
      beachSelectedCoverage,
      conditionsSetCoverage,
      submitEventCoverage,
      recentBeachSelectedCoverage,
      recentConditionsSetCoverage,
      recentSubmitEventCoverage,
      recentBuildMetadataCoverage,
      expectedRecentClientBuildStartActors,
    },
    findings: findingMessages,
    findingCodes,
  };
}

function buildExpectedRecentClientBuildStartActors(
  recentTelemetry: SessionRecentTelemetryWindow,
  expectedRecentClientBuilds: string[]
): Record<string, number> {
  const byClientBuild = new Map(
    recentTelemetry.telemetryCoverageByClientBuild.map((clientBuild) => [
      clientBuild.clientBuild,
      clientBuild.startActors,
    ])
  );
  return Object.fromEntries(
    expectedRecentClientBuilds.map((clientBuild) => [
      clientBuild,
      byClientBuild.get(clientBuild) ?? 0,
    ])
  );
}

function defaultSessionAcquisitionReadinessCriteria(): SessionAcquisitionReadinessCriteria {
  return {
    minRatedSessions: DEFAULT_MIN_RATED_SESSIONS,
    minRatedSessionUsers: DEFAULT_MIN_RATED_SESSION_USERS,
    minFiveRatedSessionUsers: DEFAULT_MIN_FIVE_RATED_SESSION_USERS,
    minFaceHeightTruthSessions: DEFAULT_MIN_FACE_HEIGHT_TRUTH_SESSIONS,
    minBeachSelectedCoverage: DEFAULT_MIN_BEACH_SELECTED_COVERAGE,
    minConditionsSetCoverage: DEFAULT_MIN_CONDITIONS_SET_COVERAGE,
    minSubmitEventCoverage: DEFAULT_MIN_SUBMIT_EVENT_COVERAGE,
    minRecentBuildMetadataCoverage: DEFAULT_MIN_RECENT_BUILD_METADATA_COVERAGE,
    expectedRecentClientBuilds: [],
  };
}

function buildGaps(input: {
  startActors: Set<string>;
  submitEventActors: Set<string>;
  savedSessionActors: Set<string>;
  ratedSessionActors: Set<string>;
  faceHeightTruthActors: Set<string>;
  ratedFaceHeightTruthActors: Set<string>;
  beachSelectedActors: Set<string>;
  conditionsSetActors: Set<string>;
  telemetryCoverageByPlatform: SessionTelemetryPlatformCoverage[];
  recentTelemetry: SessionRecentTelemetryWindow;
  validationFailedActors: Set<string>;
  validationFailuresByCode: SessionValidationFailureMetric[];
  excludedEventRows: number;
  excludedSessionRows: number;
}): string[] {
  const gaps: string[] = [];
  const beachSelectedActorsWithStart = intersectionSize(
    input.beachSelectedActors,
    input.startActors
  );
  const conditionsSetActorsWithStart = intersectionSize(
    input.conditionsSetActors,
    input.startActors
  );
  const submitActorsWithSavedSession = intersectionSize(
    input.submitEventActors,
    input.savedSessionActors
  );

  if (input.startActors.size === 0 && input.savedSessionActors.size > 0) {
    gaps.push(
      "Saved sessions exist but no stored session_log_start actors were recorded; the funnel cannot measure acquisition entry reliably."
    );
  }

  if (beachSelectedActorsWithStart < input.startActors.size) {
    const platformGaps = input.telemetryCoverageByPlatform
      .filter(
        (platform) =>
          platform.startActors > 0 &&
          (platform.beachSelectedOfStart ?? 0) < DEFAULT_MIN_BEACH_SELECTED_COVERAGE
      )
      .slice(0, 3)
      .map(
        (platform) =>
          `${platform.platform} ${formatPercent(
            platform.beachSelectedOfStart
          )} (${platform.startActors.toLocaleString()} ${pluralize(
            platform.startActors,
            "start"
          )})`
      );
    const platformSuffix =
      platformGaps.length > 0
        ? ` Platform gaps: ${platformGaps.join(", ")}.`
        : "";
    gaps.push(
      `Beach-selected events cover ${formatPercent(
        ratio(beachSelectedActorsWithStart, input.startActors.size)
      )} of start actors; inspect Telemetry Coverage By Platform before treating this as a product drop-off.${platformSuffix}`
    );
  }

  if (conditionsSetActorsWithStart < input.startActors.size) {
    const platformGaps = input.telemetryCoverageByPlatform
      .filter(
        (platform) =>
          platform.startActors > 0 &&
          (platform.conditionsSetOfStart ?? 0) <
            DEFAULT_MIN_CONDITIONS_SET_COVERAGE
      )
      .slice(0, 3)
      .map(
        (platform) =>
          `${platform.platform} ${formatPercent(
            platform.conditionsSetOfStart
          )} (${platform.startActors.toLocaleString()} ${pluralize(
            platform.startActors,
            "start"
          )})`
      );
    const platformSuffix =
      platformGaps.length > 0
        ? ` Platform gaps: ${platformGaps.join(", ")}.`
        : "";
    gaps.push(
      `Conditions-set events cover ${formatPercent(
        ratio(conditionsSetActorsWithStart, input.startActors.size)
      )} of start actors; inspect Telemetry Coverage By Platform before treating this as a product drop-off.${platformSuffix}`
    );
  }

  if (
    input.recentTelemetry.startActors > 0 &&
    (input.recentTelemetry.beachSelectedOfStart ?? 0) <
      DEFAULT_MIN_BEACH_SELECTED_COVERAGE
  ) {
    gaps.push(
      `Recent ${input.recentTelemetry.days}-day telemetry still has beach-selected coverage at ${formatPercent(
        input.recentTelemetry.beachSelectedOfStart
      )}; use the recent window to distinguish deployed instrumentation gaps from historical pre-deploy telemetry.`
    );
  }

  if (
    input.recentTelemetry.startActors > 0 &&
    (input.recentTelemetry.conditionsSetOfStart ?? 0) <
      DEFAULT_MIN_CONDITIONS_SET_COVERAGE
  ) {
    gaps.push(
      `Recent ${input.recentTelemetry.days}-day telemetry still has conditions-set coverage at ${formatPercent(
        input.recentTelemetry.conditionsSetOfStart
      )}; use the recent window to distinguish deployed instrumentation gaps from historical pre-deploy telemetry.`
    );
  }

  const recentUnknownBuildActors =
    input.recentTelemetry.startActorsWithoutBuildMetadata;
  if (recentUnknownBuildActors > 0) {
    gaps.push(
      `Recent ${input.recentTelemetry.days}-day telemetry has ${recentUnknownBuildActors.toLocaleString()} ${pluralize(
        recentUnknownBuildActors,
        "start actor"
      )} without app version/build metadata; use Client Build coverage to verify signed-in analytics adoption before diagnosing client-specific drop-off.`
    );
  }

  if (submitActorsWithSavedSession < input.savedSessionActors.size) {
    gaps.push(
      `Stored submit events cover ${formatPercent(
        ratio(submitActorsWithSavedSession, input.savedSessionActors.size)
      )} of users with saved sessions; use sessions as conversion truth until submit telemetry catches up.`
    );
  }

  if (input.ratedSessionActors.size < input.savedSessionActors.size) {
    gaps.push(
      `Rated sessions cover ${formatPercent(
        ratio(input.ratedSessionActors.size, input.savedSessionActors.size)
      )} of saved-session users; recommendation learning still depends on rating completion.`
    );
  }

  if (input.ratedFaceHeightTruthActors.size < input.ratedSessionActors.size) {
    gaps.push(
      `Rated face-height truth covers ${formatPercent(
        ratio(
          input.ratedFaceHeightTruthActors.size,
          input.ratedSessionActors.size
        )
      )} of rated-session users; Track A should keep pushing wave-height capture quality.`
    );
  }

  if (input.faceHeightTruthActors.size > input.ratedFaceHeightTruthActors.size) {
    gaps.push(
      "Some face-height labels are on unrated sessions; they help Track A truth volume but not personalization fit evaluation."
    );
  }

  if (input.validationFailedActors.size > 0) {
    const topFailures = input.validationFailuresByCode
      .slice(0, 3)
      .map(
        (failure) =>
          `${failure.code} (${failure.actors.toLocaleString()} ${pluralize(
            failure.actors,
            "actor"
          )})`
      );
    const topFailureSuffix =
      topFailures.length > 0
        ? ` Top validation failures: ${topFailures.join(", ")}.`
        : "";
    gaps.push(
      `${input.validationFailedActors.size.toLocaleString()} actors hit validation failures; inspect Validation Failure Codes before changing the session form.${topFailureSuffix}`
    );
  }

  if (input.excludedEventRows > 0 || input.excludedSessionRows > 0) {
    gaps.push(
      `Excluded ${input.excludedEventRows.toLocaleString()} event rows and ${input.excludedSessionRows.toLocaleString()} session rows from mock/system/deleted/non-real profiles.`
    );
  }

  return gaps;
}

function actorKeyForEvent(event: SessionAcquisitionEventRow): string | null {
  if (event.user_id) return `user:${event.user_id}`;
  if (event.session_id) return `anon:${event.session_id}`;
  return null;
}

function actorSetFromSessions(
  sessions: SessionAcquisitionSessionRow[]
): Set<string> {
  return new Set(sessions.map((session) => `user:${session.user_id}`));
}

function isCompletedSession(session: SessionAcquisitionSessionRow): boolean {
  return session.deleted_at === null && session.status === "completed";
}

function hasRating(session: SessionAcquisitionSessionRow): boolean {
  return typeof session.rating === "number" && Number.isFinite(session.rating);
}

function hasFaceHeight(session: SessionAcquisitionSessionRow): boolean {
  return (
    typeof session.wave_height_ft === "number" &&
    Number.isFinite(session.wave_height_ft) &&
    session.wave_height_ft > 0
  );
}

function isIncludedSession(
  session: SessionAcquisitionSessionRow,
  profileById: Map<string, SessionAcquisitionProfileRow>
): boolean {
  return isRealProfile(profileById.get(session.user_id));
}

function isRealProfile(
  profile: SessionAcquisitionProfileRow | undefined
): boolean {
  if (!profile) return true;
  if (profile.deleted_at !== null) return false;
  if (profile.is_mock === true) return false;
  if (profile.analytics_is_real_user === false) return false;
  if (profile.is_system_account === true) return false;
  return true;
}

function countRatedSessionsByUser(
  sessions: SessionAcquisitionSessionRow[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    counts.set(session.user_id, (counts.get(session.user_id) ?? 0) + 1);
  }
  return counts;
}

function countUsersAtThreshold(counts: Map<string, number>, threshold: number): number {
  return Array.from(counts.values()).filter((count) => count >= threshold).length;
}

function timestampInRange(timestamp: string, start: string, end: string): boolean {
  const time = Date.parse(timestamp);
  return time >= Date.parse(start) && time < Date.parse(end);
}

function platformForEvent(event: SessionAcquisitionEventRow): string {
  const metadata = toRecord(event.metadata);
  const nativePlatform = normalizeNativePlatform(metadata["_platform"]);
  if (nativePlatform) {
    return nativePlatform;
  }

  const device = toRecord(metadata["_device"]);
  const deviceType = normalizeFiniteLabel(
    device["device_type"],
    DEVICE_TYPE_LABELS
  );
  const os = normalizeFiniteLabel(device["os"], DEVICE_OS_LABELS);
  if (deviceType && os) {
    return `${deviceType}/${os}`;
  }

  return "unknown-platform";
}

function clientBuildForEvent(event: SessionAcquisitionEventRow): {
  clientBuild: string;
  appVersion: string;
  appBuild: string;
} {
  const metadata = toRecord(event.metadata);
  const platform = platformForEvent(event);
  const appVersion =
    normalizeAppVersion(metadata["app_version"]) ??
    normalizeAppVersion(metadata["appVersion"]) ??
    normalizeAppVersion(metadata["version"]) ??
    "unknown-version";
  const appBuild =
    normalizeAppBuild(metadata["app_build"]) ??
    normalizeAppBuild(metadata["appBuild"]) ??
    normalizeAppBuild(metadata["build"]) ??
    normalizeAppBuild(metadata["build_number"]) ??
    normalizeAppBuild(metadata["buildNumber"]) ??
    normalizeAppBuild(metadata["version_code"]) ??
    normalizeAppBuild(metadata["versionCode"]) ??
    "unknown-build";

  return {
    clientBuild: `${platform} / ${appVersion} / ${appBuild}`,
    appVersion,
    appBuild,
  };
}

function parseClientBuildLabel(clientBuild: string): {
  appVersion: string;
  appBuild: string;
} {
  const [, appVersion, appBuild] = clientBuild.split(" / ");
  return {
    appVersion: appVersion ?? "unknown-version",
    appBuild: appBuild ?? "unknown-build",
  };
}

function normalizeNativePlatform(value: unknown): string | null {
  return normalizeFiniteLabel(value, NATIVE_PLATFORM_LABELS);
}

function normalizeFiniteLabel(
  value: unknown,
  allowedValues: ReadonlySet<string>
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return allowedValues.has(normalized) ? normalized : null;
}

function normalizeAppVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return isSafeAppVersion(normalized) ? normalized : null;
}

function isSafeAppVersion(value: string): boolean {
  return (
    value.length <= MAX_APP_VERSION_LENGTH &&
    APP_VERSION_PATTERN.test(value) &&
    !UUID_PATTERN.test(value) &&
    !UNSAFE_IDENTIFIER_EVIDENCE_PATTERN.test(value)
  );
}

function normalizeAppBuild(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!APP_BUILD_PATTERN.test(normalized)) return null;
  return Number.isSafeInteger(Number(normalized)) ? normalized : null;
}

function isSafePlatformLabel(value: string): boolean {
  if (value === "unknown-platform") return true;
  if (NATIVE_PLATFORM_LABELS.has(value)) return true;
  const [deviceType, os, extra] = value.split("/");
  return (
    extra === undefined &&
    DEVICE_TYPE_LABELS.has(deviceType) &&
    DEVICE_OS_LABELS.has(os)
  );
}

function isSafeClientBuildLabel(value: string): boolean {
  const parts = value.split(" / ");
  if (parts.length !== 3) return false;
  const [platform, appVersion, appBuild] = parts;
  return (
    isSafePlatformLabel(platform) &&
    (appVersion === "unknown-version" ||
      isSafeAppVersion(appVersion)) &&
    (appBuild === "unknown-build" ||
      (APP_BUILD_PATTERN.test(appBuild) &&
        Number.isSafeInteger(Number(appBuild))))
  );
}

type CanonicalFunnelEventType =
  | "session_log_start"
  | "session_log_form_view"
  | "session_log_validation_failed"
  | "session_log_submit";

interface ParsedCanonicalEvent {
  row: SessionAcquisitionEventRow;
  eventType: CanonicalFunnelEventType | "first_session_logged";
  userId: string | null;
  flowId: string | null;
  sessionId: string | null;
  eventId: string | null;
  clientStageAtMs: number | null;
  createdAtMs: number;
  inputIndex: number;
}

interface CanonicalAttempt {
  userId: string;
  flowId: string;
  start: ParsedCanonicalEvent;
  formView: ParsedCanonicalEvent | null;
  submit: ParsedCanonicalEvent | null;
  validationFailures: ParsedCanonicalEvent[];
  persistedSession: SessionAcquisitionSessionRow | null;
}

interface CanonicalSessionAnalysis {
  attempts: CanonicalAttempt[];
  firstSessionMarkers: ParsedCanonicalEvent[];
  canonicalFunnel: CanonicalSessionFunnel;
}

function readMetadataString(metadata: unknown, key: string): string | null {
  const value = toRecord(metadata)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readClientStageAtMs(
  metadata: unknown,
  startMs: number,
  endMs: number,
): number | null {
  const raw = readMetadataString(metadata, "client_stage_at");
  if (!raw) return null;
  const value = Date.parse(raw);
  return Number.isFinite(value) && value >= startMs && value < endMs
    ? value
    : null;
}

function compareCanonicalEvents(
  left: ParsedCanonicalEvent,
  right: ParsedCanonicalEvent,
): number {
  return (
    (left.clientStageAtMs ?? Number.POSITIVE_INFINITY) -
      (right.clientStageAtMs ?? Number.POSITIVE_INFINITY) ||
    left.createdAtMs - right.createdAtMs ||
    left.inputIndex - right.inputIndex
  );
}

function parseCanonicalEvents(input: {
  events: SessionAcquisitionEventRow[];
  start: string;
  end: string;
}): ParsedCanonicalEvent[] {
  const startMs = Date.parse(input.start);
  const endMs = Date.parse(input.end);
  const canonicalEventTypes = new Set<string>([
    "session_log_start",
    "session_log_form_view",
    "session_log_validation_failed",
    "session_log_submit",
    "first_session_logged",
  ]);

  return input.events.flatMap((row, inputIndex) => {
    if (!canonicalEventTypes.has(row.event_type)) return [];
    const createdAt = Date.parse(row.created_at);
    const eventType = row.event_type as ParsedCanonicalEvent["eventType"];
    return [
      {
        row,
        eventType,
        userId: row.user_id?.trim() || null,
        flowId: readMetadataString(row.metadata, "flow_id"),
        sessionId: readMetadataString(row.metadata, "session_id"),
        eventId: readMetadataString(row.metadata, "event_id"),
        clientStageAtMs: readClientStageAtMs(row.metadata, startMs, endMs),
        createdAtMs: Number.isFinite(createdAt) ? createdAt : 0,
        inputIndex,
      },
    ];
  });
}

function deduplicateCanonicalEvents(events: ParsedCanonicalEvent[]): {
  events: ParsedCanonicalEvent[];
  stableIdConflictGroups: number;
} {
  const byStableId = new Map<string, ParsedCanonicalEvent[]>();
  const eventsWithoutStableId: ParsedCanonicalEvent[] = [];
  for (const event of events) {
    if (!event.eventId) {
      eventsWithoutStableId.push(event);
      continue;
    }
    const key = `${event.eventType}\u0000${event.eventId}`;
    const group = byStableId.get(key) ?? [];
    group.push(event);
    byStableId.set(key, group);
  }

  let stableIdConflictGroups = 0;
  const deduplicated = [...eventsWithoutStableId];
  for (const group of byStableId.values()) {
    const first = group[0];
    const applicableSessionId = (event: ParsedCanonicalEvent): string | null =>
      event.eventType === "session_log_submit" ||
      event.eventType === "first_session_logged"
        ? event.sessionId
        : null;
    const agrees = group.every(
      (event) =>
        event.userId === first.userId &&
        event.flowId === first.flowId &&
        event.clientStageAtMs === first.clientStageAtMs &&
        applicableSessionId(event) === applicableSessionId(first),
    );
    if (!agrees) {
      stableIdConflictGroups++;
      continue;
    }
    deduplicated.push([...group].sort(compareCanonicalEvents)[0]);
  }

  return { events: deduplicated, stableIdConflictGroups };
}

function classifySubmittedSession(
  submit: ParsedCanonicalEvent,
  sessionsById: Map<string, SessionAcquisitionSessionRow>,
):
  | { kind: "persisted"; session: SessionAcquisitionSessionRow }
  | { kind: "not_found" }
  | { kind: "owner_mismatch" }
  | { kind: "ineligible" } {
  if (!submit.sessionId) return { kind: "not_found" };
  const session = sessionsById.get(submit.sessionId);
  if (!session) return { kind: "not_found" };
  if (session.user_id !== submit.userId) return { kind: "owner_mismatch" };
  if (!isCompletedSession(session)) return { kind: "ineligible" };
  return { kind: "persisted", session };
}

function canonicalFunnelStep(
  key: CanonicalSessionFunnelStepKey,
  label: string,
  users: Set<string>,
  flows: number,
  startUsers: number,
  previousUsers: number | null,
): CanonicalSessionFunnelStep {
  return {
    key,
    label,
    users: users.size,
    flows,
    pctOfStart:
      key === "start"
        ? users.size > 0
          ? 1
          : null
        : ratio(users.size, startUsers),
    pctOfPrevious:
      previousUsers === null ? null : ratio(users.size, previousUsers),
  };
}

function computeCanonicalSessionAnalysis(input: {
  events: SessionAcquisitionEventRow[];
  windowSessions: SessionAcquisitionSessionRow[];
  start: string;
  end: string;
}): CanonicalSessionAnalysis {
  const parsedEvents = parseCanonicalEvents(input);
  const deduplicated = deduplicateCanonicalEvents(parsedEvents);
  const joinCoverage: CanonicalSessionJoinCoverage = {
    funnelEventRowsMissingUserId: 0,
    funnelEventsMissingFlowId: 0,
    submitEventsMissingSessionId: 0,
    firstSessionMarkersMissingSessionId: 0,
    firstSessionMarkersMissingUserId: 0,
    funnelEventsWithUnusableClientStageAt: 0,
    stableIdConflictGroups: deduplicated.stableIdConflictGroups,
    submitFlowsWithoutWindowSession: 0,
    submitFlowsWithSessionOwnerMismatch: 0,
    submitFlowsWithIneligibleSession: 0,
  };
  const firstSessionMarkers: ParsedCanonicalEvent[] = [];
  const eventsByAttempt = new Map<string, ParsedCanonicalEvent[]>();

  for (const event of deduplicated.events) {
    if (event.eventType === "first_session_logged") {
      firstSessionMarkers.push(event);
      if (!event.userId) joinCoverage.firstSessionMarkersMissingUserId++;
      if (!event.sessionId) joinCoverage.firstSessionMarkersMissingSessionId++;
      continue;
    }

    if (!event.userId) joinCoverage.funnelEventRowsMissingUserId++;
    if (!event.flowId) joinCoverage.funnelEventsMissingFlowId++;
    if (event.eventType === "session_log_submit" && !event.sessionId) {
      joinCoverage.submitEventsMissingSessionId++;
    }
    if (event.clientStageAtMs === null) {
      joinCoverage.funnelEventsWithUnusableClientStageAt++;
    }
    if (!event.userId || !event.flowId || event.clientStageAtMs === null) {
      continue;
    }

    const key = JSON.stringify([event.userId, event.flowId]);
    const attemptEvents = eventsByAttempt.get(key) ?? [];
    attemptEvents.push(event);
    eventsByAttempt.set(key, attemptEvents);
  }

  const attempts: CanonicalAttempt[] = [];
  for (const attemptEvents of eventsByAttempt.values()) {
    const ordered = [...attemptEvents].sort(compareCanonicalEvents);
    const start = ordered.find(
      (event) => event.eventType === "session_log_start",
    );
    if (
      !start ||
      !start.userId ||
      !start.flowId ||
      start.clientStageAtMs === null
    ) {
      continue;
    }
    const startClientStageAtMs = start.clientStageAtMs;
    const startIndex = ordered.indexOf(start);
    const formView =
      ordered
        .slice(startIndex + 1)
        .find(
          (event) =>
            event.eventType === "session_log_form_view" &&
            event.clientStageAtMs !== null &&
            event.clientStageAtMs >= startClientStageAtMs,
        ) ?? null;
    const submit = formView
      ? (ordered
          .slice(ordered.indexOf(formView) + 1)
          .find(
            (event) =>
              event.eventType === "session_log_submit" &&
              event.clientStageAtMs !== null &&
              event.clientStageAtMs >= formView.clientStageAtMs! &&
              event.sessionId !== null,
          ) ?? null)
      : null;
    attempts.push({
      userId: start.userId,
      flowId: start.flowId,
      start,
      formView,
      submit,
      validationFailures: ordered.filter(
        (event) => event.eventType === "session_log_validation_failed",
      ),
      persistedSession: null,
    });
  }

  const sessionsById = new Map<string, SessionAcquisitionSessionRow>(
    input.windowSessions.map((session) => [session.id, session]),
  );
  for (const attempt of attempts) {
    if (!attempt.submit) continue;
    const classification = classifySubmittedSession(
      attempt.submit,
      sessionsById,
    );
    if (classification.kind === "persisted") {
      attempt.persistedSession = classification.session;
      continue;
    }
    if (classification.kind === "not_found") {
      joinCoverage.submitFlowsWithoutWindowSession++;
      continue;
    }
    if (classification.kind === "owner_mismatch") {
      joinCoverage.submitFlowsWithSessionOwnerMismatch++;
      continue;
    }
    joinCoverage.submitFlowsWithIneligibleSession++;
  }

  const formViewAttempts = attempts.filter(
    (attempt) => attempt.formView !== null,
  );
  const submitAttempts = attempts.filter((attempt) => attempt.submit !== null);
  const persistedAttempts = attempts.filter(
    (attempt) => attempt.persistedSession !== null,
  );
  const rejectedSubmitFlows =
    joinCoverage.submitFlowsWithoutWindowSession +
    joinCoverage.submitFlowsWithSessionOwnerMismatch +
    joinCoverage.submitFlowsWithIneligibleSession;
  if (
    rejectedSubmitFlows !==
    submitAttempts.length - persistedAttempts.length
  ) {
    throw new Error(
      "Canonical persistence buckets must partition submitted flows.",
    );
  }

  const usersFor = (entries: CanonicalAttempt[]): Set<string> =>
    new Set(entries.map((attempt) => attempt.userId));
  const startUsers = usersFor(attempts);
  const formViewUsers = usersFor(formViewAttempts);
  const submitUsers = usersFor(submitAttempts);
  const persistedUsers = usersFor(persistedAttempts);
  const canonicalFunnel: CanonicalSessionFunnel = {
    grain: "unique_user",
    ordering: "metadata.client_stage_at",
    steps: [
      canonicalFunnelStep(
        "start",
        "Form started",
        startUsers,
        attempts.length,
        startUsers.size,
        null,
      ),
      canonicalFunnelStep(
        "form_view",
        "Form viewed",
        formViewUsers,
        formViewAttempts.length,
        startUsers.size,
        startUsers.size,
      ),
      canonicalFunnelStep(
        "submit",
        "Submitted",
        submitUsers,
        submitAttempts.length,
        startUsers.size,
        formViewUsers.size,
      ),
      canonicalFunnelStep(
        "persisted_session",
        "Persisted session",
        persistedUsers,
        persistedAttempts.length,
        startUsers.size,
        submitUsers.size,
      ),
    ],
    joinCoverage,
  };

  return { attempts, firstSessionMarkers, canonicalFunnel };
}

function isHistoricallyCompletedSession(
  session: SessionAcquisitionSessionRow
): boolean {
  return session.status === "completed";
}

function buildFirstCompletedSessionByUser(
  lifetimeSessions: SessionAcquisitionSessionRow[],
  end: string
): Map<string, SessionAcquisitionSessionRow> {
  const sorted = lifetimeSessions
    .filter(isHistoricallyCompletedSession)
    .filter((session) => Date.parse(session.created_at) < Date.parse(end))
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at) ||
        left.id.localeCompare(right.id)
    );
  const firstByUser = new Map<string, SessionAcquisitionSessionRow>();
  for (const session of sorted) {
    if (!firstByUser.has(session.user_id)) {
      firstByUser.set(session.user_id, session);
    }
  }
  return firstByUser;
}

function buildFirstSessionTelemetryCoverage(input: {
  attempts: CanonicalAttempt[];
  firstSessionMarkers: ParsedCanonicalEvent[];
  lifetimeSessions: SessionAcquisitionSessionRow[];
  end: string;
}): FirstSessionTelemetryCoverage {
  const firstCompletedSessionByUser = buildFirstCompletedSessionByUser(
    input.lifetimeSessions,
    input.end
  );
  const persistedFirstSessionByUser = new Map<string, string>();

  for (const attempt of input.attempts) {
    const persistedSession = attempt.persistedSession;
    const historicalFirst = firstCompletedSessionByUser.get(attempt.userId);
    if (!persistedSession || !historicalFirst) continue;
    if (persistedSession.id !== historicalFirst.id) continue;
    persistedFirstSessionByUser.set(attempt.userId, persistedSession.id);
  }

  const markerUsers = new Set<string>();
  for (const marker of input.firstSessionMarkers) {
    if (!marker.userId || !marker.sessionId) continue;
    if (persistedFirstSessionByUser.get(marker.userId) !== marker.sessionId) {
      continue;
    }
    markerUsers.add(marker.userId);
  }

  const persistedFirstSessionUsers = persistedFirstSessionByUser.size;
  return {
    persistedFirstSessionUsers,
    markerUsers: markerUsers.size,
    coverage: ratio(markerUsers.size, persistedFirstSessionUsers),
  };
}

function buildSessionValidationBranch(
  attempts: CanonicalAttempt[],
  formViewUsers: number,
): SessionValidationBranch {
  const affectedUsers = new Set<string>();
  const recoveredUsers = new Set<string>();
  let affectedFlows = 0;
  let recoveredFlows = 0;

  for (const attempt of attempts) {
    const formView = attempt.formView;
    if (!formView) continue;
    const firstSubmit = attempt.submit;
    const affected = attempt.validationFailures.some((event) => {
      if (compareCanonicalEvents(event, formView) < 0) {
        return false;
      }
      return !firstSubmit || compareCanonicalEvents(event, firstSubmit) < 0;
    });
    if (!affected) continue;

    affectedFlows += 1;
    affectedUsers.add(attempt.userId);
    if (firstSubmit) {
      recoveredFlows += 1;
      recoveredUsers.add(attempt.userId);
    }
  }

  return {
    affectedUsers: affectedUsers.size,
    affectedFlows,
    pctOfFormViewUsers: ratio(affectedUsers.size, formViewUsers),
    recoveredUsers: recoveredUsers.size,
    recoveredFlows,
    recoveryRate: ratio(recoveredUsers.size, affectedUsers.size),
  };
}

function extractValidationErrorCodes(metadata: unknown): string[] {
  const record = toRecord(metadata);
  const rawValues = [
    ...collectStringValues(record["validation_errors"]),
    ...collectStringValues(record["validation_error_codes"]),
    ...collectStringValues(record["validationErrorCodes"]),
    ...collectStringValues(record["error_codes"]),
    ...collectStringValues(record["error_code"]),
    ...collectStringValues(record["validation_error"]),
  ];
  const codes = normalizeUniqueStrings(
    rawValues.flatMap((value) => {
      const normalized = normalizeValidationErrorCode(value);
      return normalized ? [normalized] : [];
    })
  );
  return codes.length > 0 ? codes : ["unknown"];
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}

function normalizeValidationErrorCode(value: string): string | null {
  const code = value.trim().toLowerCase();
  if (!code) return null;
  if (isSessionFormValidationErrorCode(code)) return code;
  if (/^[a-z0-9_.:-]{1,80}$/.test(code)) return `unknown_code:${code}`;
  return "unrecognized";
}

function isSessionFormValidationErrorCode(
  value: string
): value is SessionFormValidationErrorCode {
  return SESSION_FORM_VALIDATION_ERROR_CODE_SET.has(value);
}

function normalizeSource(source: string | null): string {
  const normalized = source?.trim();
  return normalized && normalized.length > 0 ? normalized : "unknown";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key = keyFn(row);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return sortCountRecord(counts);
}

function sortCountRecord(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  );
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count++;
  }
  return count;
}

function ratio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const index = Math.min(
    values.length - 1,
    Math.ceil(values.length * percentileValue) - 1
  );
  return values[index];
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / MS_PER_DAY);
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(1);
}

function normalizeUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function onboardingLine(label: string, count: number, denominator: number): string {
  return `| ${label} | ${count.toLocaleString()} | ${formatPercent(
    ratio(count, denominator)
  )} |`;
}

function renderCountTable(counts: Record<string, number>, label: string): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "_No rows._";

  const lines = [`| ${label} | Count |`, "| --- | ---: |"];
  for (const [key, count] of entries) {
    lines.push(`| ${key} | ${count.toLocaleString()} |`);
  }
  return lines.join("\n");
}

function topPlatformLabel(counts: Record<string, number>): string {
  const [first] = Object.entries(counts);
  if (!first) return "n/a";
  return `${first[0]} (${first[1].toLocaleString()})`;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size));
  }
  return result;
}

async function runCli(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.validateOutputJsonPath) {
    const result = validateSessionAcquisitionReportFile(
      options.validateOutputJsonPath,
      {
        maxReportAgeHours: options.maxReportAgeHours,
      }
    );
    if (!result.ok) {
      throw new Error(
        `Session acquisition report JSON failed validation:\n- ${result.blockers.join(
          "\n- "
        )}`
      );
    }
    console.log(
      `Session acquisition report JSON is valid: ${options.validateOutputJsonPath}`
    );
    return;
  }

  const supabase = createAdminClient();
  const { events, windowSessions, lifetimeSessions, profiles } =
    await readSessionAcquisitionSourceRows(supabase, options);

  const report = computeSessionAcquisitionReport({
    ...options,
    events,
    windowSessions,
    lifetimeSessions,
    profiles,
    readinessCriteria: sessionAcquisitionReadinessCriteriaFromOptions(options),
  });

  if (options.outputJsonPath) {
    const outputPath = writeSessionAcquisitionReportJson(
      options.outputJsonPath,
      report
    );
    console.error(`Wrote session acquisition report JSON: ${outputPath}`);
  }

  process.stdout.write(renderSessionAcquisitionReport(report));
  if (
    options.failOnNotReady &&
    !report.readiness.readyForPersonalizationEvaluation
  ) {
    process.exitCode = 2;
  }
}

if (require.main === module) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
