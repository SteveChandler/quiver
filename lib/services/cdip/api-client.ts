/**
 * HTTP client for CDIP API requests
 *
 * Handles all network communication with the CDIP ERDDAP API.
 */

import { createContextLogger } from "@/lib/logger";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import { CDIPRateLimiter } from "@/lib/utils/rate-limiter";
import {
  CDIPDataResponse,
  CDIPMetaResponse,
  CDIPSkipReason,
  CDIPWaveDataDiagnostic,
} from "./types";
import {
  CDIP_API_CONFIG,
  USER_AGENT,
} from "./constants";
import { transformERDDAPToDataResponse, normalizeStationIdForErddap } from "./data-parser";

const log = createContextLogger("CDIPApiClient");

function stationBreakerKey(stationId: string): string {
  return `CDIP:${normalizeStationIdForErddap(stationId)}`;
}

function statusFromError(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

function cdipSkipReasonFromStatus(status: number | undefined): CDIPSkipReason {
  if (status === 400) return "cdip_400";
  if (status === 404) return "cdip_404";
  return "cdip_unavailable";
}

function isDeterministicUnavailableStatus(status: number | undefined): boolean {
  return status === 400 || status === 404;
}

/**
 * CDIP API client for fetching wave data from ERDDAP
 */
export class CDIPApiClient {
  private readonly userAgent: string;

  constructor(userAgent: string = USER_AGENT) {
    this.userAgent = userAgent;
  }

  /**
   * Check if verbose logging is enabled
   */
  private isVerbose(): boolean {
    return isForecastVerboseLoggingEnabled();
  }

  /**
   * Fetch raw wave data from CDIP ERDDAP API
   *
   * @param stationId - The station ID
   * @returns Raw data response or null on error
   */
  async fetchWaveData(stationId: string): Promise<CDIPDataResponse | null> {
    const diagnostic = await this.fetchWaveDataWithDiagnostics(stationId);
    return diagnostic.data;
  }

  async fetchWaveDataWithDiagnostics(stationId: string): Promise<CDIPWaveDataDiagnostic> {
    const normalizedStationId = normalizeStationIdForErddap(stationId);
    const breakerKey = stationBreakerKey(stationId);

    try {
      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");

      // Use ERDDAP API - construct the URL with wave data endpoint
      const endpoint = CDIP_API_CONFIG.endpoints.waveData.replace(
        "{stationId}",
        normalizedStationId
      );
      const url = `${CDIP_API_CONFIG.baseUrl}${endpoint}`;

      if (this.isVerbose()) {
        log.debug(`🌊 Fetching CDIP data from: ${url}`);
      }

      const response = await apiClient.fetchCDIPData(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      }, {
        circuitBreakerKey: breakerKey,
      });

      if (!response.ok) {
        const message =
          `❌ CDIP API error: ${response.status} - ${response.statusText} for station ${stationId}`;
        if (isDeterministicUnavailableStatus(response.status)) {
          log.warn(message);
        } else {
          log.error(message);
        }
        return {
          data: null,
          stationId,
          skipReason: cdipSkipReasonFromStatus(response.status),
          breakerKey,
          status: response.status,
        };
      }

      const data = await response.json();

      // ERDDAP returns data in a different format: {table: {columnNames: [...], rows: [[...]]}}
      if (
        !data ||
        !data.table ||
        !data.table.rows ||
        data.table.rows.length === 0
      ) {
        log.warn(`⚠️ CDIP returned empty data for station ${stationId}`);
        return {
          data: null,
          stationId,
          skipReason: "cdip_unavailable",
          breakerKey,
        };
      }

      // Transform ERDDAP format to CDIPDataResponse format with proper array structure
      const transformedData = transformERDDAPToDataResponse(data, stationId);

      if (this.isVerbose()) {
        log.debug(
          `✅ Successfully fetched CDIP data for station ${stationId}: ${transformedData.data.length} data points`
        );
      }

      return {
        data: transformedData,
        stationId,
        skipReason: "success",
        breakerKey,
      };
    } catch (error) {
      const { isCircuitBreakerOpenError } = await import("@/lib/utils/api-retry");
      const status = statusFromError(error);

      if (isDeterministicUnavailableStatus(status)) {
        log.warn(`CDIP station ${stationId} has no deterministic data (${status})`);
      } else if (error instanceof Error && error.name === "AbortError") {
        log.error(`⏰ CDIP API request timeout for station ${stationId}`);
      } else {
        log.error(
          `💥 CDIP API request failed for station ${stationId}:`,
          error
        );
      }
      return {
        data: null,
        stationId,
        skipReason: isCircuitBreakerOpenError(error)
          ? "circuit_open"
          : cdipSkipReasonFromStatus(status),
        breakerKey,
        status,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fetch station metadata from CDIP ERDDAP API
   *
   * @param stationId - The station ID
   * @returns Station metadata or null on error
   */
  async fetchMetadata(stationId: string): Promise<CDIPMetaResponse | null> {
    try {
      if (!CDIPRateLimiter.canMakeRequest()) {
        log.warn(`⏰ CDIP rate limit exceeded for metadata request`);
        return null;
      }

      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");

      const normalizedStationId = normalizeStationIdForErddap(stationId);
      const endpoint = CDIP_API_CONFIG.endpoints.metadata.replace(
        "{stationId}",
        normalizedStationId
      );
      const url = `${CDIP_API_CONFIG.baseUrl}${endpoint}`;

      const response = await apiClient.fetchCDIPData(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      }, {
        circuitBreakerKey: stationBreakerKey(stationId),
      });

      if (!response.ok) {
        const message =
          `CDIP metadata API error: ${response.status} - ${response.statusText}`;
        if (isDeterministicUnavailableStatus(response.status)) {
          log.warn(message);
        } else {
          log.error(message);
        }
        return null;
      }

      const data = await response.json();
      CDIPRateLimiter.recordRequest(`metadata/${stationId}`);

      return data as CDIPMetaResponse;
    } catch (error) {
      const status = statusFromError(error);
      if (isDeterministicUnavailableStatus(status)) {
        log.warn(`CDIP metadata unavailable for station ${stationId} (${status})`);
      } else {
        log.error(
          `Error fetching CDIP metadata for station ${stationId}:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * Check if a request can be made (rate limit check)
   *
   * @returns true if request can be made, false otherwise
   */
  canMakeRequest(): boolean {
    return CDIPRateLimiter.canMakeRequest();
  }

  /**
   * Get time until next request can be made
   *
   * @returns Time in milliseconds
   */
  getTimeUntilReset(): number {
    return CDIPRateLimiter.getTimeUntilReset();
  }

  /**
   * Record a successful request for rate limiting
   *
   * @param endpoint - The endpoint that was called
   */
  recordRequest(endpoint: string): void {
    CDIPRateLimiter.recordRequest(endpoint);
  }
}
