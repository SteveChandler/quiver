import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

// Stormglass API endpoints
const STORMGLASS_BASE_URL = "https://api.stormglass.io/v2";
const STORMGLASS_WEATHER_ENDPOINT = `${STORMGLASS_BASE_URL}/weather/point`;
const STORMGLASS_TIDE_ENDPOINT = `${STORMGLASS_BASE_URL}/tide/extremes/point`;

// Stormglass API parameters
const WEATHER_PARAMS = [
  "waveHeight",
  "wavePeriod",
  "waveDirection",
  "waterTemperature",
  "windSpeed",
  "windDirection",
  "airTemperature",
  "precipitation",
  "cloudCover",
];

// Helper function to convert wave height from meters to feet
function metersToFeet(meters: number): string {
  const feet = meters * 3.28084;
  const roundedFeet = Math.round(feet);
  return `${roundedFeet} ft`;
}

// Helper function to convert temperature from Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): string {
  const fahrenheit = (celsius * 9) / 5 + 32;
  const roundedFahrenheit = Math.round(fahrenheit);
  return `${roundedFahrenheit}°F`;
}

// Helper function to convert wind speed from m/s to mph
function msToMph(ms: number): string {
  const mph = ms * 2.23694;
  const roundedMph = Math.round(mph);
  return `${roundedMph} mph`;
}

// Helper function to determine tide status
function getTideStatus(currentTime: Date, tideData: any[]): string {
  if (!tideData || tideData.length === 0) return "Unknown";

  // Find the closest tide events (before and after current time)
  const sortedTides = [...tideData].sort((a, b) => {
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  let prevTide = null;
  let nextTide = null;

  for (let i = 0; i < sortedTides.length; i++) {
    const tideTime = new Date(sortedTides[i].time).getTime();
    const currentTimeMs = currentTime.getTime();

    if (tideTime <= currentTimeMs) {
      prevTide = sortedTides[i];
    } else {
      nextTide = sortedTides[i];
      break;
    }
  }

  if (!prevTide && nextTide) {
    return nextTide.type === "high" ? "Rising" : "Falling";
  }

  if (prevTide && !nextTide) {
    return prevTide.type === "high" ? "Falling" : "Rising";
  }

  if (prevTide && nextTide) {
    if (prevTide.type === "high" && nextTide.type === "low") {
      return "Falling";
    } else if (prevTide.type === "low" && nextTide.type === "high") {
      return "Rising";
    } else if (prevTide.type === nextTide.type) {
      // This shouldn't happen with proper tide data, but just in case
      return "Unknown";
    }
  }

  return "Unknown";
}

// Helper function to determine weather condition
function getWeatherCondition(
  cloudCover: number,
  precipitation: number
): string {
  if (precipitation > 0.5) return "Rainy";
  if (precipitation > 0.1) return "Light Rain";
  if (cloudCover > 80) return "Cloudy";
  if (cloudCover > 40) return "Partly Cloudy";
  return "Sunny";
}

// Helper function to determine wind direction as text
function getWindDirectionText(degrees: number): string {
  // Beach is typically facing the ocean, so we need to determine if wind is onshore, offshore, or cross-shore
  // This is a simplified approach - in a real app, you'd compare with the beach's actual orientation
  if (degrees > 135 && degrees < 225) return "Onshore"; // Assuming beach faces west
  if (degrees > 315 || degrees < 45) return "Offshore"; // Assuming beach faces west
  return "Cross-shore";
}

// Main function to fetch forecast data from Stormglass API
export async function fetchForecastData(beach: Beach, apiKey: string) {
  try {
    console.log(
      `Fetching forecast data for ${beach.name} (${beach.latitude}, ${beach.longitude})`
    );
    console.log(`Using API key: ${apiKey.substring(0, 8)}...`);

    // Fetch weather data
    const weatherUrl = `${STORMGLASS_WEATHER_ENDPOINT}?lat=${
      beach.latitude
    }&lng=${beach.longitude}&params=${WEATHER_PARAMS.join(",")}`;
    console.log(`Calling weather API: ${weatherUrl}`);

    const weatherResponse = await fetch(weatherUrl, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!weatherResponse.ok) {
      const errorText = await weatherResponse.text();
      console.error(`Weather API error response: ${errorText}`);
      throw new Error(
        `Weather API error: ${weatherResponse.status} ${weatherResponse.statusText} - ${errorText}`
      );
    }

    const weatherData = await weatherResponse.json();
    console.log(
      `Weather data received: ${weatherData.hours?.length || 0} hourly points`
    );

    // Fetch tide data
    const tideUrl = `${STORMGLASS_TIDE_ENDPOINT}?lat=${beach.latitude}&lng=${beach.longitude}`;
    console.log(`Calling tide API: ${tideUrl}`);

    const tideResponse = await fetch(tideUrl, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!tideResponse.ok) {
      const errorText = await tideResponse.text();
      console.error(`Tide API error response: ${errorText}`);
      throw new Error(
        `Tide API error: ${tideResponse.status} ${tideResponse.statusText} - ${errorText}`
      );
    }

    const tideData = await tideResponse.json();
    console.log(`Tide data received: ${tideData.data?.length || 0} extremes`);

    // Process the data
    const forecasts = weatherData.hours.map((hour: any) => {
      const time = new Date(hour.time);

      // Extract data from the first source available (e.g., "sg" for Stormglass)
      const source = Object.keys(hour.waveHeight)[0];

      const waveHeight = metersToFeet(hour.waveHeight[source]);
      const waterTemp = celsiusToFahrenheit(hour.waterTemperature[source]);
      const windSpeed = msToMph(hour.windSpeed[source]);
      const windDirection = getWindDirectionText(hour.windDirection[source]);
      const tide = getTideStatus(time, tideData.data);
      const weatherCondition = getWeatherCondition(
        hour.cloudCover[source],
        hour.precipitation[source]
      );

      return {
        forecast_date: time.toISOString().split("T")[0],
        forecast_time: time.toISOString().split("T")[1].substring(0, 8),
        wave_height: waveHeight,
        water_temp: waterTemp,
        wind_speed: windSpeed,
        wind_direction: windDirection,
        tide,
        weather_condition: weatherCondition,
        beach_id: beach.id,
      };
    });

    console.log(
      `Processed ${forecasts.length} forecast points for ${beach.name}`
    );
    return forecasts;
  } catch (error) {
    console.error(`Error fetching forecast data for ${beach.name}:`, error);
    throw error;
  }
}

// Function to update forecasts in the database
export async function updateForecasts(beach: Beach, apiKey: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Fetch forecast data from API
    const forecasts = await fetchForecastData(beach, apiKey);

    // Delete existing forecasts for this beach
    await supabase.from("forecasts").delete().eq("beach_id", beach.id);

    // Insert new forecasts
    const { data, error } = await supabase.from("forecasts").insert(
      forecasts.map((forecast) => ({
        id: crypto.randomUUID(),
        ...forecast,
      }))
    );

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error updating forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Function to update forecasts for all beaches
export async function updateAllForecasts(apiKey: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get all beaches
    const { data: beaches, error } = await supabase.from("beaches").select("*");

    if (error) {
      throw error;
    }

    // Update forecasts for each beach
    const results = await Promise.all(
      beaches.map(async (beach) => {
        try {
          const result = await updateForecasts(beach, apiKey);
          return { beach: beach.name, success: result.success };
        } catch (error) {
          return { beach: beach.name, success: false, error };
        }
      })
    );

    return { success: true, results };
  } catch (error) {
    console.error("Error updating all forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
