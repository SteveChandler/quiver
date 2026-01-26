/**
 * IOOS API Client
 *
 * HTTP client for making requests to the ERDDAP API with proper error handling,
 * timeouts, and response parsing.
 *
 * @module ioos/api-client
 */

import { fetchWithTimeout } from "@/lib/utils/fetch-utils";
import { IOOS_API_CONFIG } from "@/lib/constants/ioos-config";
import { IOOSServiceConfig } from "@/types/ioos";

/**
 * ERDDAP table response format
 */
export interface ERDDAPTableResponse {
  table: {
    columnNames: string[];
    rows: (string | number | null)[][];
  };
}

/**
 * ERDDAP info response format (for variable discovery)
 */
export interface ERDDAPInfoResponse {
  table: {
    columnNames: string[];
    rows: (string | null)[][];
  };
}

/**
 * Fetch data from ERDDAP API
 *
 * @param url - Full ERDDAP API URL
 * @param config - Service configuration for timeouts and user agent
 * @returns Parsed JSON response
 * @throws Error if request fails or times out
 */
export async function fetchERDDAP<T = ERDDAPTableResponse>(
  url: string,
  config: IOOSServiceConfig = IOOS_API_CONFIG
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    timeoutMs: config.timeoutMs,
    init: {
      headers: {
        "User-Agent": config.userAgent,
      },
    },
  });

  if (!response.ok) {
    throw new Error(`ERDDAP API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all datasets from ERDDAP
 *
 * @param url - All datasets endpoint URL
 * @param config - Service configuration
 * @returns Table with dataset information
 */
export async function fetchAllDatasets(
  url: string,
  config?: IOOSServiceConfig
): Promise<ERDDAPTableResponse> {
  return fetchERDDAP<ERDDAPTableResponse>(url, config);
}

/**
 * Fetch observation data for a station
 *
 * @param url - Observation endpoint URL
 * @param config - Service configuration
 * @returns Table with observation data or null if station has no wave data
 */
export async function fetchObservation(
  url: string,
  config?: IOOSServiceConfig
): Promise<ERDDAPTableResponse | null> {
  try {
    return await fetchERDDAP<ERDDAPTableResponse>(url, config);
  } catch (error) {
    // Check if the error is due to missing wave variables
    // ERDDAP returns 400 with "Unrecognized variable" for missing fields
    if (error instanceof Error && error.message.includes("400")) {
      return null;
    }
    throw error;
  }
}

/**
 * Fetch station variables from ERDDAP /info endpoint
 *
 * @param url - Station info endpoint URL
 * @param config - Service configuration
 * @returns Info response with variable names or null if station doesn't exist
 */
export async function fetchStationInfo(
  url: string,
  config?: IOOSServiceConfig
): Promise<ERDDAPInfoResponse | null> {
  try {
    return await fetchERDDAP<ERDDAPInfoResponse>(url, config);
  } catch (error) {
    // 404 means station doesn't exist
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * Check if error response indicates missing wave variables
 *
 * @param response - HTTP response object
 * @returns True if error is due to unrecognized variables
 */
export async function isUnrecognizedVariableError(response: Response): Promise<boolean> {
  if (!response.ok && response.status === 400) {
    try {
      const errorText = await response.text();
      return errorText.includes("Unrecognized variable");
    } catch {
      return false;
    }
  }
  return false;
}
