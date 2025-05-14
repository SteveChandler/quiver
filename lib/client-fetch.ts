/**
 * Client-side functions for fetching data
 */

// Ocean Beach, San Diego coordinates
export const OCEAN_BEACH_LAT = 32.7503;
export const OCEAN_BEACH_LNG = -117.2534;

/**
 * Updates forecast data for a specific beach via API call
 * @param beachId - ID of the beach to update
 * @param debug - Whether to include debug information in the response
 * @returns Result of the update operation
 */
export async function updateBeachForecastData(
  beachId?: string,
  debug: boolean = false
) {
  try {
    // Build the URL with appropriate parameters
    const params = new URLSearchParams();
    if (beachId) params.append("beachId", beachId);
    if (debug) params.append("debug", "true");

    const url = `/api/forecasts/update${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    console.log(`Calling forecast update API: ${url}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache",
      },
    });

    const responseData = await response.json();

    if (!response.ok) {
      const error =
        responseData.error || `Server responded with status ${response.status}`;
      console.error("Error response from forecast API:", responseData);
      throw new Error(error);
    }

    console.log("Forecast update successful:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error updating forecast data:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Creates a fake delay for UI feedback
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets Ocean Beach data directly
 * Useful when database operations fail
 * @param debug - Whether to include debug information
 */
export async function getDirectOceanBeachForecast(debug: boolean = false) {
  try {
    console.log("Attempting to get direct Ocean Beach forecast data");

    // First try the API route with debug information if requested
    const updateResult = await updateBeachForecastData(undefined, debug);

    if (updateResult.success) {
      console.log("Successfully updated forecast data");
      // If successful, we should now have updated forecasts in the database
      return { success: true };
    } else {
      // If API route fails, log detailed error
      const errorDetails = updateResult.error ? `: ${updateResult.error}` : "";

      console.error(
        `Failed to update Ocean Beach forecast${errorDetails}`,
        updateResult
      );
      return {
        success: false,
        error: updateResult.error || "Unknown API error",
        details: debug ? updateResult : undefined,
      };
    }
  } catch (error) {
    console.error("Error getting Ocean Beach forecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    };
  }
}
