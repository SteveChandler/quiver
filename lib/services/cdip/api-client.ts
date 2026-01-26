/**
 * HTTP client for CDIP API requests
 *
 * Handles all network communication with the CDIP ERDDAP API.
 */

import { createContextLogger } from "@/lib/logger";
import { isForecastVerboseLoggingEnabled } from "@/lib/monitoring/forecast-logger";
import { CDIPRateLimiter } from "@/lib/utils/rate-limiter";
import { CDIPDataResponse, CDIPMetaResponse } from "./types";
import {
  CDIP_API_CONFIG,
  USER_AGENT,
} from "./constants";
import { transformERDDAPToDataResponse, normalizeStationIdForErddap } from "./data-parser";

const log = createContextLogger("CDIPApiClient");

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
    try {
      // Import retry client dynamically to avoid circular dependencies
      const { apiClient } = await import("@/lib/utils/api-retry");

      // Use ERDDAP API - construct the URL with wave data endpoint
      const normalizedStationId = normalizeStationIdForErddap(stationId);
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
      });

      if (!response.ok) {
        log.error(
          `❌ CDIP API error: ${response.status} - ${response.statusText} for station ${stationId}`
        );
        return null;
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
        return null;
      }

      // Transform ERDDAP format to CDIPDataResponse format with proper array structure
      const transformedData = transformERDDAPToDataResponse(data, stationId);

      if (this.isVerbose()) {
        log.debug(
          `✅ Successfully fetched CDIP data for station ${stationId}: ${transformedData.data.length} data points`
        );
      }

      return transformedData;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        log.error(`⏰ CDIP API request timeout for station ${stationId}`);
      } else {
        log.error(
          `💥 CDIP API request failed for station ${stationId}:`,
          error
        );
      }
      return null;
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
      });

      if (!response.ok) {
        log.error(
          `CDIP metadata API error: ${response.status} - ${response.statusText}`
        );
        return null;
      }

      const data = await response.json();
      CDIPRateLimiter.recordRequest(`metadata/${stationId}`);

      return data as CDIPMetaResponse;
    } catch (error) {
      log.error(
        `Error fetching CDIP metadata for station ${stationId}:`,
        error
      );
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
