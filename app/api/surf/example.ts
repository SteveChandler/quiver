import { getSurfForecast, resolveBeach } from "./utils";

/**
 * Example usage of the surf forecast API
 */
async function exampleUsage() {
  try {
    // Example 1: Get forecast by beach name
    const beachNameForecast = await getSurfForecast({
      beach: "Ocean Beach",
    });
    console.log("Beach name forecast:", {
      beach: beachNameForecast.beach,
      coords: beachNameForecast.coords,
      forecastSample: beachNameForecast.forecast.hours?.[0], // First hour of forecast
    });

    // Example 2: Get forecast by coordinates
    const coordsForecast = await getSurfForecast({
      coords: { lat: 32.7507, lng: -117.254 }, // Ocean Beach coordinates
    });
    console.log("Coordinates forecast:", {
      beach: coordsForecast.beach,
      coords: coordsForecast.coords,
      forecastSample: coordsForecast.forecast.hours?.[0], // First hour of forecast
    });

    // Example 3: Find nearest beach to a location
    const userLocation = { lat: 32.7157, lng: -117.1611 }; // Downtown San Diego
    const nearestBeach = resolveBeach(userLocation);
    console.log("Nearest beach to downtown:", nearestBeach);

    // Example 4: Find beach by partial name
    const partialNameBeach = resolveBeach("la jolla");
    console.log("Found beach by partial name:", partialNameBeach);
  } catch (error) {
    console.error("Error in example:", error);
  }
}

// Note: This is just an example - don't call it automatically
// exampleUsage();

export { exampleUsage };
