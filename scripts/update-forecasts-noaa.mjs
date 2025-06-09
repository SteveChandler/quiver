#!/usr/bin/env node

/**
 * Update forecasts using NOAA data with live buoy conditions
 * This combines NOAA weather forecasts with live buoy data for accurate surf conditions
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Required:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// NOAA API endpoints
const NOAA_API_BASE = "https://api.weather.gov";
const NDBC_API_BASE = "https://www.ndbc.noaa.gov/data/realtime2";

// Helper function to calculate distance between two points
function getDistance(lat1, lng1, lat2, lng2) {
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

// Helper functions for unit conversion
function metersToFeet(meters) {
  const feet = meters * 3.28084;
  return `${feet.toFixed(1)} ft`;
}

function celsiusToFahrenheit(celsius) {
  const fahrenheit = (celsius * 9) / 5 + 32;
  return `${fahrenheit.toFixed(0)}°F`;
}

// Find nearest buoy with live data
async function findNearestBuoyWithData(lat, lng) {
  try {
    const { data: buoys, error } = await supabase
      .from("buoys")
      .select("*")
      .eq("active", true)
      .not("wave_height", "is", null)
      .not("water_temperature", "is", null);

    if (error || !buoys) {
      console.log("No buoys with live data found");
      return null;
    }

    // Calculate distances and find nearest
    const buoysWithDistance = buoys
      .map((buoy) => {
        let buoyLat, buoyLng;

        // Handle different coordinate formats
        if (buoy.coordinates) {
          try {
            // Try parsing as JSON first (PostGIS format)
            const coords = JSON.parse(buoy.coordinates);
            if (coords.coordinates && Array.isArray(coords.coordinates)) {
              buoyLng = coords.coordinates[0];
              buoyLat = coords.coordinates[1];
            }
          } catch (e) {
            // If JSON parsing fails, try parsing as "POINT(lng lat)"
            const pointMatch = buoy.coordinates.match(/POINT\(([^)]+)\)/);
            if (pointMatch) {
              const parts = pointMatch[1].split(" ");
              if (parts.length === 2) {
                buoyLng = parseFloat(parts[0]);
                buoyLat = parseFloat(parts[1]);
              }
            }
          }
        }

        if (!buoyLat || !buoyLng) {
          console.log(
            `⚠️  Could not parse coordinates for buoy ${buoy.buoy_uuid}: ${buoy.coordinates}`
          );
          return null;
        }

        return {
          ...buoy,
          distance: getDistance(lat, lng, buoyLat, buoyLng),
          lat: buoyLat,
          lng: buoyLng,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance);

    return buoysWithDistance[0] || null;
  } catch (error) {
    console.error("Error finding nearest buoy:", error);
    return null;
  }
}

// Fetch NOAA weather forecast
async function fetchNOAAForecast(lat, lng) {
  try {
    console.log(`Fetching NOAA forecast for ${lat}, ${lng}`);

    // First, get the grid coordinates
    const pointsUrl = `${NOAA_API_BASE}/points/${lat},${lng}`;
    const pointsResponse = await fetch(pointsUrl, {
      headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
    });

    if (!pointsResponse.ok) {
      throw new Error(`NOAA points API error: ${pointsResponse.status}`);
    }

    const pointsData = await pointsResponse.json();
    const forecastUrl = pointsData.properties.forecastHourly;

    if (!forecastUrl) {
      throw new Error("No forecast URL available");
    }

    // Fetch hourly forecast
    const forecastResponse = await fetch(forecastUrl, {
      headers: { "User-Agent": "quiver-surf-app (contact@quiver.com)" },
    });

    if (!forecastResponse.ok) {
      throw new Error(`NOAA forecast API error: ${forecastResponse.status}`);
    }

    const forecastData = await forecastResponse.json();
    return forecastData.properties.periods || [];
  } catch (error) {
    console.error("Error fetching NOAA forecast:", error);
    throw error;
  }
}

// Generate forecast data combining NOAA weather with live buoy data
async function generateForecastData(beach) {
  try {
    console.log(`\n🌊 Generating forecast for ${beach.name}...`);

    // Find nearest buoy with live data
    const nearestBuoy = await findNearestBuoyWithData(
      beach.latitude,
      beach.longitude
    );
    if (nearestBuoy) {
      console.log(
        `📡 Using buoy ${nearestBuoy.buoy_uuid} (${nearestBuoy.distance.toFixed(
          1
        )}km away)`
      );
      console.log(
        `   Wave height: ${nearestBuoy.wave_height}m, Water temp: ${nearestBuoy.water_temperature}°C`
      );
    } else {
      console.log("⚠️  No nearby buoys with live data found");
    }

    // Fetch NOAA weather forecast
    const forecastPeriods = await fetchNOAAForecast(
      beach.latitude,
      beach.longitude
    );
    console.log(`📅 Retrieved ${forecastPeriods.length} forecast periods`);

    // Process forecast data into our format
    const forecasts = forecastPeriods
      .slice(0, 168) // 7 days * 24 hours
      .map((period, index) => {
        const startTime = new Date(period.startTime);

        // Use live buoy data for current conditions, forecast for future
        const isCurrentHour = index === 0;
        const useLiveBuoy = isCurrentHour && nearestBuoy;

        // Extract temperature from forecast
        const temperature = period.temperature || 70;

        // Extract wind from forecast
        const windMatch = period.windSpeed?.match(/(\d+)/);
        const windSpeed = windMatch ? parseInt(windMatch[1]) : 10;
        const windDirection = period.windDirection || "Variable";

        // Wave data: use buoy if available, otherwise estimate from wind
        let waveHeight;
        if (useLiveBuoy && nearestBuoy.wave_height) {
          waveHeight = metersToFeet(nearestBuoy.wave_height);
        } else {
          // Estimate wave height from wind speed
          const estimatedWaveMeters = Math.max(0.5, windSpeed * 0.1);
          waveHeight = metersToFeet(estimatedWaveMeters);
        }

        // Water temperature: use buoy if available, otherwise estimate
        let waterTemp;
        if (useLiveBuoy && nearestBuoy.water_temperature) {
          waterTemp = celsiusToFahrenheit(nearestBuoy.water_temperature);
        } else {
          // Estimate water temp (usually cooler than air temp)
          const estimatedWaterTemp = Math.max(temperature - 5, 60);
          waterTemp = `${estimatedWaterTemp}°F`;
        }

        return {
          beach_id: beach.id,
          forecast_date: startTime.toISOString().split("T")[0],
          forecast_time: startTime.toTimeString().split(" ")[0],
          wave_height: waveHeight,
          water_temp: waterTemp,
          wind_speed: `${windSpeed} mph`,
          wind_direction: windDirection,
          weather_condition: period.shortForecast || "Partly Cloudy",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

    return forecasts;
  } catch (error) {
    console.error(`Error generating forecast for ${beach.name}:`, error);
    throw error;
  }
}

// Update forecasts for a single beach
async function updateBeachForecast(beach) {
  try {
    const forecasts = await generateForecastData(beach);

    // Delete existing forecasts for this beach
    const { error: deleteError } = await supabase
      .from("forecasts")
      .delete()
      .eq("beach_id", beach.id);

    if (deleteError) {
      console.error(`Error deleting old forecasts: ${deleteError.message}`);
    }

    // Insert new forecasts
    const { data, error: insertError } = await supabase
      .from("forecasts")
      .insert(forecasts);

    if (insertError) {
      throw insertError;
    }

    console.log(`✅ Updated ${forecasts.length} forecasts for ${beach.name}`);
    return { success: true, count: forecasts.length };
  } catch (error) {
    console.error(`❌ Failed to update ${beach.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main function to update all beach forecasts
async function updateAllForecasts() {
  try {
    console.log("🏄‍♂️ Starting NOAA forecast update with live buoy data...\n");

    // Get all beaches
    const { data: beaches, error } = await supabase
      .from("beaches")
      .select("*")
      .order("name");

    if (error) {
      throw error;
    }

    if (!beaches || beaches.length === 0) {
      console.log("❌ No beaches found in database");
      return;
    }

    console.log(`📍 Found ${beaches.length} beaches to update`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Update forecasts for each beach
    for (const beach of beaches) {
      const result = await updateBeachForecast(beach);

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      results.push({
        beach: beach.name,
        success: result.success,
        count: result.count || 0,
        error: result.error,
      });

      // Small delay to avoid overwhelming APIs
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("\n📊 Update Summary:");
    console.log(`✅ Successful: ${successCount} beaches`);
    console.log(`❌ Failed: ${failureCount} beaches`);

    if (failureCount > 0) {
      console.log("\nFailed beaches:");
      results
        .filter((r) => !r.success)
        .forEach((r) => console.log(`   ❌ ${r.beach}: ${r.error}`));
    }

    console.log("\n🎉 Forecast update completed!");
  } catch (error) {
    console.error("❌ Fatal error updating forecasts:", error);
    process.exit(1);
  }
}

// Run the update
updateAllForecasts();
