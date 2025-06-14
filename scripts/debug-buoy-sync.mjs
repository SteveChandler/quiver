#!/usr/bin/env node

/**
 * Debug script to diagnose buoy sync issues
 * Usage: node scripts/debug-buoy-sync.mjs
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function debugSync() {
  try {
    console.log("🔍 Debugging NOAA Buoy Sync...\n");

    // Check 1: Do we have beaches in the database?
    console.log("1️⃣ Checking for beaches in database...");

    const beachesResponse = await fetch(
      "http://localhost:3000/api/beaches/nearby?latitude=32.7&longitude=-117.2&limit=50",
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    let beaches = [];
    if (beachesResponse.ok) {
      beaches = await beachesResponse.json();
      console.log(`   Found ${beaches.length} beaches in database:`);

      if (beaches.length > 0) {
        beaches.slice(0, 5).forEach((beach) => {
          console.log(
            `   • ${beach.name} (${beach.latitude}, ${beach.longitude})`
          );
        });
        if (beaches.length > 5) {
          console.log(`   • ... and ${beaches.length - 5} more`);
        }
      } else {
        console.log(
          "   ❌ No beaches found! You need to populate the beaches table first."
        );
        console.log(
          "   💡 Add some beaches to your database before syncing buoys."
        );
        return;
      }
    } else {
      console.log("   ❌ Failed to fetch beaches:", beachesResponse.status);
      return;
    }

    // Check 2: Sample NOAA data parsing
    console.log("\n2️⃣ Testing NOAA data parsing...");

    const noaaResponse = await fetch(
      "https://www.ndbc.noaa.gov/data/stations/station_table.txt"
    );
    if (!noaaResponse.ok) {
      console.log("   ❌ Failed to fetch NOAA data");
      return;
    }

    const noaaData = await noaaResponse.text();
    const lines = noaaData.split("\n");

    console.log(`   Found ${lines.length} lines of NOAA data`);
    console.log("   Sample of first few data lines:");

    let validStations = 0;
    let invalidCoordinates = 0;
    let skippedInactive = 0;

    // Parse first 20 stations as sample
    for (let i = 2; i < Math.min(22, lines.length); i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowData = line.split("|");
      if (rowData.length < 7) continue;

      const stationId = rowData[0]?.trim();
      const stationName = rowData[4]?.trim();
      const coordString = rowData[6]?.trim();
      const status = rowData[rowData.length - 1]?.trim();

      // Check if should be skipped
      if (
        status?.match(
          /(destroy|disestablished|decommissioned|internal\s+use\s+only)/i
        )
      ) {
        console.log(`   ⚠️  SKIP ${stationId}: ${status.substring(0, 50)}...`);
        skippedInactive++;
        continue;
      }

      // Try to parse coordinates
      const coords = parseCoordinates(coordString);
      if (coords) {
        console.log(
          `   ✅ ${stationId}: ${stationName} → [${coords[0]}, ${coords[1]}]`
        );
        validStations++;
      } else {
        console.log(`   ❌ ${stationId}: Failed to parse "${coordString}"`);
        invalidCoordinates++;
      }
    }

    console.log(`\n   📊 Sample Results:`);
    console.log(`   • Valid stations: ${validStations}`);
    console.log(`   • Invalid coordinates: ${invalidCoordinates}`);
    console.log(`   • Skipped inactive: ${skippedInactive}`);

    // Check 3: Distance calculation with a known California buoy
    console.log("\n3️⃣ Testing distance calculations...");

    // Use a known NOAA buoy near California: 46232 (Monterey Bay)
    const testBuoyLat = 36.785;
    const testBuoyLng = -121.818;

    const testBeaches = [
      { name: "Santa Cruz", lat: 36.9741, lng: -122.0308 },
      { name: "Monterey", lat: 36.6002, lng: -121.8947 },
      { name: "San Diego", lat: 32.7157, lng: -117.1611 },
    ];

    testBeaches.forEach((beach) => {
      const distance = calculateDistance(
        testBuoyLat,
        testBuoyLng,
        beach.lat,
        beach.lng
      );
      console.log(
        `   Distance from test buoy to ${beach.name}: ${distance.toFixed(1)}km`
      );
    });

    // Check 4: Simulate full sync process
    console.log("\n4️⃣ Simulating full sync process...");

    // Parse all NOAA stations with validation
    let allStations = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const rowData = line.split("|");
      if (rowData.length < 7) continue;

      const stationId = rowData[0]?.trim();
      const stationName = rowData[4]?.trim();
      const coordString = rowData[6]?.trim();
      const status = rowData[rowData.length - 1]?.trim();

      // Skip inactive stations
      if (
        status?.match(
          /(destroy|disestablished|decommissioned|internal\s+use\s+only)/i
        )
      ) {
        continue;
      }

      // Parse coordinates
      const coords = parseCoordinates(coordString);
      if (!coords || !isValidUSCoordinates(coords)) {
        invalidCount++;
        continue;
      }

      validCount++;
      allStations.push({
        stationId,
        stationName,
        coordinates: coords,
      });
    }

    console.log(
      `   Parsed ${allStations.length} valid US stations (${invalidCount} invalid filtered out)`
    );

    // Find stations near San Diego beaches
    const sdBeaches = beaches.filter(
      (b) =>
        b.latitude > 32 &&
        b.latitude < 34 &&
        b.longitude > -118 &&
        b.longitude < -116
    );

    console.log(
      `   Checking ${sdBeaches.length} San Diego area beaches:`,
      sdBeaches.slice(0, 3).map((b) => b.name)
    );

    let nearbyStations = [];
    let closeButNotNearby = [];

    allStations.forEach((station) => {
      let minDistance = Infinity;
      let closestBeach = "";

      sdBeaches.forEach((beach) => {
        const distance = calculateDistance(
          station.coordinates[0],
          station.coordinates[1],
          beach.latitude,
          beach.longitude
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestBeach = beach.name;
        }
      });

      if (minDistance <= 200) {
        nearbyStations.push({
          ...station,
          distance: minDistance,
          closestBeach,
        });
      } else if (minDistance <= 400) {
        closeButNotNearby.push({
          ...station,
          distance: minDistance,
          closestBeach,
        });
      }
    });

    console.log(
      `   🎯 Found ${nearbyStations.length} stations within 200km of San Diego beaches`
    );

    if (nearbyStations.length > 0) {
      console.log("   🎉 Nearby stations:");
      nearbyStations.slice(0, 5).forEach((s) => {
        console.log(
          `      • ${s.stationId}: ${s.stationName} (${s.distance.toFixed(
            1
          )}km from ${s.closestBeach})`
        );
      });
    } else {
      console.log("   📍 No stations within 200km. Closest ones:");
      closeButNotNearby
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .forEach((s) => {
          console.log(
            `      • ${s.stationId}: ${s.stationName} (${s.distance.toFixed(
              1
            )}km from ${s.closestBeach})`
          );
        });

      if (closeButNotNearby.length === 0) {
        console.log("      ❌ No stations found within 400km either!");
        console.log(
          "      💡 Try increasing search radius: npm run buoy:sync:wide (500km)"
        );
      }
    }
  } catch (error) {
    console.error("❌ Debug failed:", error.message);
  }
}

// Coordinate parsing function (simplified version of the one in the sync service)
function parseCoordinates(coordString) {
  try {
    if (!coordString) return null;

    // Decode HTML entities
    const decoded = coordString
      .replace(/&#176;/g, "°")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");

    // Try simple format first: "34.0 N 120.0 W"
    const parts = decoded.trim().split(/\s+/);
    if (parts.length === 4) {
      let lat = parseFloat(parts[0]);
      let lng = parseFloat(parts[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        if (parts[1].toUpperCase() === "S") lat *= -1;
        if (parts[3].toUpperCase() === "W") lng *= -1;
        return [lat, lng];
      }
    }

    // Try extracting from complex format
    const beforeParens = decoded.split("(")[0].trim();
    const decimalParts = beforeParens.split(/\s+/);

    if (decimalParts.length >= 4) {
      let lat = parseFloat(decimalParts[0]);
      let lng = parseFloat(decimalParts[2]);

      if (!isNaN(lat) && !isNaN(lng)) {
        if (decimalParts[1].toUpperCase() === "S") lat *= -1;
        if (decimalParts[3].toUpperCase() === "W") lng *= -1;
        return [lat, lng];
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Distance calculation (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
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

// Helper to validate US coordinates
function isValidUSCoordinates(coordinates) {
  const [lat, lng] = coordinates;
  return (
    lat >= 15 &&
    lat <= 72 && // Latitude bounds (includes Hawaii to Alaska)
    lng >= -180 &&
    lng <= -60 && // Longitude bounds (Alaska to Maine)
    !(lat === 0 && lng === 0) // Exclude obvious null coordinates
  );
}

debugSync();
