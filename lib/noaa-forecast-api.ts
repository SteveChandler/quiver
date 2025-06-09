import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

// NOAA API endpoints
const NOAA_API_BASE = "https://api.weather.gov";
const NDBC_API_BASE = "https://www.ndbc.noaa.gov/data/realtime2";

// San Diego area buoy stations
const SAN_DIEGO_BUOYS = [
  {
    id: "46224", // Oceanside Offshore
    name: "Oceanside Offshore, CA",
    lat: 33.178,
    lng: -117.472,
    distance: 0, // Will be calculated
  },
  {
    id: "46232", // Point Reyes
    name: "Point Reyes, CA",
    lat: 37.759,
    lng: -123.468,
    distance: 0,
  },
  {
    id: "46231", // Monterey Bay
    name: "Monterey Bay, CA",
    lat: 36.751,
    lng: -122.338,
    distance: 0,
  },
];

// Helper function to calculate distance between two points
function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper function to find nearest buoy
function findNearestBuoy(lat: number, lng: number) {
  const buoysWithDistance = SAN_DIEGO_BUOYS.map((buoy) => ({
    ...buoy,
    distance: getDistance(lat, lng, buoy.lat, buoy.lng),
  })).sort((a, b) => a.distance - b.distance);

  return buoysWithDistance[0];
}

// Helper function to convert knots to mph
function knotsToMph(knots: number): string {
  const mph = knots * 1.15078;
  return `${Math.round(mph)} mph`;
}

// Helper function to convert meters to feet
function metersToFeet(meters: number): string {
  const feet = meters * 3.28084;
  return `${Math.round(feet)} ft`;
}

// Helper function to convert Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): string {
  const fahrenheit = (celsius * 9) / 5 + 32;
  return `${Math.round(fahrenheit)}°F`;
}

// Helper function to get wind direction text
function getWindDirectionText(degrees: number): string {
  if (degrees >= 337.5 || degrees < 22.5) return "N";
  if (degrees < 67.5) return "NE";
  if (degrees < 112.5) return "E";
  if (degrees < 157.5) return "SE";
  if (degrees < 202.5) return "S";
  if (degrees < 247.5) return "SW";
  if (degrees < 292.5) return "W";
  if (degrees < 337.5) return "NW";
  return "Variable";
}

// Helper function to determine weather condition
function getWeatherCondition(temp: number, windSpeed: number): string {
  if (windSpeed > 25) return "Windy";
  if (windSpeed > 15) return "Breezy";
  if (temp > 80) return "Hot";
  if (temp > 70) return "Warm";
  if (temp > 60) return "Mild";
  if (temp > 50) return "Cool";
  return "Cold";
}

// Fetch real-time buoy data from NDBC
async function fetchBuoyData(stationId: string) {
  try {
    console.log(`Fetching buoy data for station ${stationId}`);

    // NDBC real-time data URL
    const buoyUrl = `${NDBC_API_BASE}/${stationId}.txt`;

    const response = await fetch(buoyUrl, {
      headers: {
        "User-Agent": "quiver-surf-app (contact@quiver.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Buoy API error: ${response.status}`);
    }

    const data = await response.text();
    const lines = data.split("\n");

    if (lines.length < 3) {
      throw new Error("Invalid buoy data format");
    }

    // Parse the latest data (skip header lines)
    const latestData = lines[2].split(/\s+/);

    if (latestData.length < 8) {
      throw new Error("Insufficient buoy data");
    }

    // NDBC data format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
    const [
      year,
      month,
      day,
      hour,
      minute,
      windDir,
      windSpeed,
      gust,
      waveHeight,
      dominantPeriod,
      avgPeriod,
      meanWaveDir,
      pressure,
      airTemp,
      waterTemp,
    ] = latestData;

    return {
      timestamp: `20${year}-${month.padStart(2, "0")}-${day.padStart(
        2,
        "0"
      )}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00Z`,
      windDirection: windDir !== "MM" ? parseFloat(windDir) : null,
      windSpeed: windSpeed !== "MM" ? parseFloat(windSpeed) : null,
      waveHeight: waveHeight !== "MM" ? parseFloat(waveHeight) : null,
      dominantPeriod:
        dominantPeriod !== "MM" ? parseFloat(dominantPeriod) : null,
      waterTemp: waterTemp !== "MM" ? parseFloat(waterTemp) : null,
      airTemp: airTemp !== "MM" ? parseFloat(airTemp) : null,
      pressure: pressure !== "MM" ? parseFloat(pressure) : null,
    };
  } catch (error) {
    console.error(`Error fetching buoy data for ${stationId}:`, error);
    throw error;
  }
}

// Fetch NOAA weather forecast
async function fetchNOAAForecast(lat: number, lng: number) {
  try {
    console.log(`Fetching NOAA forecast for ${lat}, ${lng}`);

    // First, get the grid coordinates
    const pointsUrl = `${NOAA_API_BASE}/points/${lat},${lng}`;

    const pointsResponse = await fetch(pointsUrl, {
      headers: {
        "User-Agent": "quiver-surf-app (contact@quiver.com)",
      },
    });

    if (!pointsResponse.ok) {
      throw new Error(`NOAA points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();

    // Get the forecast URL
    const forecastUrl = pointsData.properties.forecastHourly;

    if (!forecastUrl) {
      throw new Error("No forecast URL available");
    }

    // Fetch hourly forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: {
        "User-Agent": "quiver-surf-app (contact@quiver.com)",
      },
    });

    if (!forecastResponse.ok) {
      throw new Error(`NOAA forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();

    return forecastData.properties.periods || [];
  } catch (error) {
    console.error(`Error fetching NOAA forecast:`, error);
    throw error;
  }
}

// Main function to fetch forecast data using NOAA APIs
export async function fetchNOAAForecastData(beach: Beach) {
  try {
    console.log(
      `Fetching NOAA forecast data for ${beach.name} (${beach.latitude}, ${beach.longitude})`
    );

    // Find nearest buoy for wave data
    const nearestBuoy = findNearestBuoy(beach.latitude, beach.longitude);
    console.log(
      `Using nearest buoy: ${nearestBuoy.name} (${nearestBuoy.distance.toFixed(
        1
      )}km away)`
    );

    // Fetch both buoy data and NOAA forecast
    const [buoyData, forecastData] = await Promise.all([
      fetchBuoyData(nearestBuoy.id).catch((err) => {
        console.warn(`Buoy data failed: ${err.message}`);
        return null;
      }),
      fetchNOAAForecast(beach.latitude, beach.longitude),
    ]);

    console.log(`NOAA forecast received: ${forecastData.length} periods`);

    // Process forecast data into our format
    const forecasts = forecastData
      .slice(0, 168)
      .map((period: any, index: number) => {
        // 7 days * 24 hours
        const startTime = new Date(period.startTime);

        // Use buoy data for current conditions, forecast for future
        const isCurrentHour = index === 0;
        const useRealtimeBuoy = isCurrentHour && buoyData;

        // Extract temperature from forecast
        const tempMatch = period.temperature || 70; // Default if not available

        // Extract wind from forecast
        const windMatch = period.windSpeed?.match(/(\d+)/);
        const windSpeed = windMatch ? parseInt(windMatch[1]) : 10;

        const windDirection = period.windDirection || "Variable";

        // Wave data: use buoy if available, otherwise estimate from wind
        let waveHeight: string;
        if (useRealtimeBuoy && buoyData.waveHeight) {
          waveHeight = metersToFeet(buoyData.waveHeight);
        } else {
          // Rough estimate: wave height often correlates with wind speed
          const estimatedWaveMeters = Math.max(0.5, windSpeed * 0.1); // Simple heuristic
          waveHeight = metersToFeet(estimatedWaveMeters);
        }

        // Water temperature: use buoy if available, otherwise estimate
        let waterTemp: string;
        if (useRealtimeBuoy && buoyData.waterTemp) {
          waterTemp = celsiusToFahrenheit(buoyData.waterTemp);
        } else {
          // Estimate water temp (usually cooler than air temp)
          const estimatedWaterTemp = Math.max(tempMatch - 5, 60);
          waterTemp = `${estimatedWaterTemp}°F`;
        }

        return {
          forecast_date: startTime.toISOString().split("T")[0],
          forecast_time: startTime.toISOString().split("T")[1].substring(0, 8),
          wave_height: waveHeight,
          water_temp: waterTemp,
          wind_speed: `${windSpeed} mph`,
          wind_direction: windDirection,
          tide: "Unknown", // Would need separate tide API
          weather_condition:
            period.shortForecast || getWeatherCondition(tempMatch, windSpeed),
          beach_id: beach.id,
        };
      });

    console.log(
      `Processed ${forecasts.length} NOAA forecast points for ${beach.name}`
    );
    return forecasts;
  } catch (error) {
    console.error(
      `Error fetching NOAA forecast data for ${beach.name}:`,
      error
    );
    throw error;
  }
}

// Function to update forecasts using NOAA (replacement for Stormglass)
export async function updateNOAAForecasts(beach: Beach) {
  const supabase = await createSupabaseServerClient();

  try {
    // Fetch forecast data from NOAA APIs
    const forecasts = await fetchNOAAForecastData(beach);

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

    console.log(
      `✅ Successfully updated ${forecasts.length} forecasts for ${beach.name} using NOAA data`
    );
    return { success: true, data };
  } catch (error) {
    console.error("Error updating NOAA forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Function to update forecasts for all beaches using NOAA
export async function updateAllNOAAForecasts() {
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
          const result = await updateNOAAForecasts(beach);
          return { beach: beach.name, success: result.success };
        } catch (error) {
          return { beach: beach.name, success: false, error };
        }
      })
    );

    return { success: true, results };
  } catch (error) {
    console.error("Error updating all NOAA forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
