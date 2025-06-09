import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

async function updatePacificBeachOnly() {
  try {
    console.log(
      "🎯 Targeting Pacific Beach only to serve the whole cluster..."
    );

    // Wait for dev server to be ready
    console.log("⏳ Waiting for server to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Make a targeted update to Pacific Beach only
    // This should populate the cluster cache for Ocean Beach, Sunset Cliffs, etc.
    const response = await fetch(
      "http://localhost:3000/api/forecasts/update?maxUpdates=1&debug=true",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("📊 Update result:", JSON.stringify(result, null, 2));

    if (result.success && result.summary?.beaches_updated > 0) {
      console.log(
        "✅ SUCCESS! Pacific Beach updated - cluster cache should now work"
      );
      console.log(
        "🏖️ Ocean Beach and nearby beaches should now have fresh data"
      );

      // Test the Ocean Beach endpoint to verify
      console.log("\n🧪 Testing Ocean Beach endpoint...");
      const testResponse = await fetch(
        "http://localhost:3000/api/surf?beach=Ocean%20Beach",
        {
          method: "GET",
        }
      );

      if (testResponse.ok) {
        const testResult = await testResponse.json();
        console.log("🎉 Ocean Beach data:", {
          date: testResult.forecast?.forecast_date,
          time: testResult.forecast?.forecast_time,
          waves: testResult.forecast?.wave_height,
          wind: testResult.forecast?.wind_speed,
        });

        // Check if we got today's date
        const today = new Date().toISOString().split("T")[0];
        if (testResult.forecast?.forecast_date >= today) {
          console.log("✅ SUCCESS! Fresh forecast data is now available");
        } else {
          console.log(
            "⚠️ Still showing old data - cache may need time to populate"
          );
        }
      }
    } else {
      console.log("❌ Update failed:", result.error || "Unknown error");
      if (result.error?.includes("quota")) {
        console.log("💡 Quota exhausted - try again tomorrow");
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("💡 Make sure your dev server is running: npm run dev");
    }
  }
}

console.log("🌊 Pacific Beach Cluster Update Script");
console.log("📅 Run this tomorrow when your API quota resets");
console.log(
  "🎯 Will update just 1 beach to serve the whole cluster efficiently\n"
);

updatePacificBeachOnly();
