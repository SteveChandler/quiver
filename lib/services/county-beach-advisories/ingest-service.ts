import "server-only";

import { randomUUID } from "node:crypto";

import { alertCountyFeedOperator, warnCountyFeedOperator } from "./alerts";
import { CountyFeedError } from "./county-client";
import { normalizeCountyNotifications } from "./normalizer";
import {
  COUNTY_BASE_BACKOFF_MS,
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_MAX_CONSECUTIVE_FAILURES,
  COUNTY_MIN_POLL_INTERVAL_MS,
  COUNTY_EVENT_TYPE_IDENTIFIERS,
  type CountyAdvisoryRepository,
  type CountyFeedFetcher,
  type CountyIngestResult,
  type CountyIngestState,
} from "./types";

function emptyState(): CountyIngestState {
  return {
    source_identifier: COUNTY_FEED_SOURCE_IDENTIFIER,
    accepted_version_token: null,
    accepted_version_sequence: null,
    observed_version_token: null,
    observed_version_sequence: null,
    consecutive_failures: 0,
    circuit_open: false,
    next_attempt_at: null,
    last_request_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_error: null,
    updated_at: null,
  };
}

function errorKindFor(error: unknown): CountyFeedError["kind"] {
  if (error instanceof CountyFeedError) return error.kind;
  return "transient";
}

function errorMessageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function nextBackoffAt(now: Date, consecutiveFailures: number): string {
  const exponent = Math.max(0, consecutiveFailures - 1);
  const delay = COUNTY_BASE_BACKOFF_MS * 2 ** exponent;
  return new Date(now.getTime() + delay).toISOString();
}

async function saveFailure(
  repository: CountyAdvisoryRepository,
  state: CountyIngestState,
  now: Date,
  error: unknown,
  observedVersion?: { token: string; sequence: number },
): Promise<CountyIngestResult> {
  const errorKind = errorKindFor(error);
  const errorMessage = errorMessageFor(error);
  const consecutiveFailures = state.consecutive_failures + 1;
  const fatal = errorKind === "version_mismatch" || errorKind === "shape_change";
  const circuitOpen = fatal || consecutiveFailures >= COUNTY_MAX_CONSECUTIVE_FAILURES;
  const nextState: CountyIngestState = {
    ...state,
    observed_version_token: observedVersion?.token ?? state.observed_version_token,
    observed_version_sequence:
      observedVersion?.sequence ?? state.observed_version_sequence,
    consecutive_failures: consecutiveFailures,
    circuit_open: circuitOpen,
    next_attempt_at: circuitOpen ? null : nextBackoffAt(now, consecutiveFailures),
    last_failure_at: now.toISOString(),
    last_error: errorMessage,
    updated_at: now.toISOString(),
  };
  await repository.saveState(nextState);

  if (circuitOpen) {
    alertCountyFeedOperator(
      `circuit opened after ${consecutiveFailures} failure(s): ${errorMessage}`,
    );
  }

  return {
    status: "error",
    errorKind,
    error: errorMessage,
    circuitOpen,
    consecutiveFailures,
  };
}

export async function runCountyAdvisoryIngest(options: {
  fetcher: CountyFeedFetcher;
  repository: CountyAdvisoryRepository;
  now?: Date;
}): Promise<CountyIngestResult> {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const state = (await options.repository.getState()) ?? emptyState();

  if (state.circuit_open) {
    return { status: "skipped", reason: "circuit_open", nextAttemptAt: null };
  }

  if (state.next_attempt_at && Date.parse(state.next_attempt_at) > nowMs) {
    return {
      status: "skipped",
      reason: "backoff",
      nextAttemptAt: state.next_attempt_at,
    };
  }

  if (state.last_request_at && nowMs - Date.parse(state.last_request_at) < COUNTY_MIN_POLL_INTERVAL_MS) {
    return {
      status: "skipped",
      reason: "poll_interval",
      nextAttemptAt: new Date(Date.parse(state.last_request_at) + COUNTY_MIN_POLL_INTERVAL_MS).toISOString(),
    };
  }

  const requestStartedAt = now.toISOString();
  const stateBeforeRequest: CountyIngestState = {
    ...state,
    last_request_at: requestStartedAt,
    updated_at: requestStartedAt,
  };
  await options.repository.saveState(stateBeforeRequest);

  let manifest;
  try {
    manifest = await options.fetcher.fetchManifest();
  } catch (error) {
    return saveFailure(options.repository, stateBeforeRequest, now, error);
  }

  const observedVersion = {
    token: manifest.versionToken,
    sequence: manifest.versionSequence,
  };
  if (
    state.accepted_version_token !== null &&
    (state.accepted_version_token !== manifest.versionToken ||
      state.accepted_version_sequence !== manifest.versionSequence)
  ) {
    return saveFailure(
      options.repository,
      {
        ...stateBeforeRequest,
        observed_version_token: manifest.versionToken,
        observed_version_sequence: manifest.versionSequence,
      },
      now,
      new CountyFeedError(
        "version_mismatch",
        `County API version changed from ${state.accepted_version_sequence}/${state.accepted_version_token} to ${manifest.versionSequence}/${manifest.versionToken}`,
      ),
      observedVersion,
    );
  }

  const acceptedState: CountyIngestState = {
    ...stateBeforeRequest,
    accepted_version_token: state.accepted_version_token ?? manifest.versionToken,
    accepted_version_sequence:
      state.accepted_version_sequence ?? manifest.versionSequence,
    observed_version_token: manifest.versionToken,
    observed_version_sequence: manifest.versionSequence,
    updated_at: requestStartedAt,
  };
  await options.repository.saveState(acceptedState);

  const runId = randomUUID();
  await options.repository.createRun({
    id: runId,
    source_identifier: COUNTY_FEED_SOURCE_IDENTIFIER,
    status: "started",
    version_token: manifest.versionToken,
    version_sequence: manifest.versionSequence,
    fetched_at: requestStartedAt,
  });

  try {
    const responses = [];
    for (const eventTypeIdentifier of COUNTY_EVENT_TYPE_IDENTIFIERS) {
      responses.push(
        await options.fetcher.fetchNotifications(eventTypeIdentifier, manifest),
      );
    }

    const beaches = await options.repository.listBeaches();
    const summary = normalizeCountyNotifications(responses, beaches, requestStartedAt);
    await options.repository.insertAdvisories(summary.records, runId);
    await options.repository.completeRun(runId, {
      countsByType: summary.countsByType,
      unmatchedSites: summary.unmatchedSites,
      matchRate: summary.matchRate,
      recordCount: summary.records.length,
      completedAt: requestStartedAt,
    });
    await options.repository.saveState({
      ...acceptedState,
      consecutive_failures: 0,
      circuit_open: false,
      next_attempt_at: null,
      last_success_at: requestStartedAt,
      last_error: null,
      updated_at: requestStartedAt,
    });

    if (summary.unmatchedSites > 0) {
      warnCountyFeedOperator(
        `County feed matched ${summary.matchedSites}/${summary.totalSites} unique sites; ${summary.unmatchedSites} remain unmatched`,
      );
    }

    return {
      status: "ok",
      runId,
      fetchedAt: requestStartedAt,
      versionSequence: manifest.versionSequence,
      versionToken: manifest.versionToken,
      summary,
    };
  } catch (error) {
    try {
      await options.repository.failRun(runId, errorKindFor(error), errorMessageFor(error));
    } catch {
      // Keep the original feed failure as the surfaced error.
    }
    return saveFailure(options.repository, acceptedState, now, error, observedVersion);
  }
}
