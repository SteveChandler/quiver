/**
 * Manual test script to verify refactored city resolution logic
 *
 * Run with: npx tsx scripts/test-city-resolution.ts
 */

import { findCitiesMatchingPattern, findCityBySlug } from "../actions/city/city-metadata-actions";

async function testCityResolution() {
  console.log("Testing city resolution refactoring...\n");

  // Test 1: Direct slug match (should work as before)
  console.log("Test 1: Direct slug with state suffix");
  const test1 = await findCityBySlug("belmar-nj");
  console.log("belmar-nj:", test1.success ? `✓ Found: ${test1.data?.cityName}, ${test1.data?.state}` : "✗ Not found");

  // Test 2: Base slug that exists directly
  console.log("\nTest 2: Base slug without suffix (unique city)");
  const test2 = await findCityBySlug("santa-cruz");
  console.log("santa-cruz:", test2.success ? `✓ Found: ${test2.data?.cityName}, ${test2.data?.state}` : "✗ Not found");

  // Test 3: Pattern matching across all states (new function)
  console.log("\nTest 3: Pattern matching across all states");
  const test3 = await findCitiesMatchingPattern("belmar");
  if (test3.success && test3.data) {
    console.log(`belmar pattern match: ✓ Found ${test3.data.length} cities`);
    test3.data.forEach((city) => {
      console.log(`  - ${city.city}, ${city.state} (${city.beach_count} beaches)`);
    });
  } else {
    console.log("belmar pattern match: ✗ Not found");
  }

  // Test 4: Pattern matching for common city name
  console.log("\nTest 4: Pattern matching for common city name");
  const test4 = await findCitiesMatchingPattern("newport");
  if (test4.success && test4.data) {
    console.log(`newport pattern match: ✓ Found ${test4.data.length} cities`);
    test4.data.slice(0, 5).forEach((city) => {
      console.log(`  - ${city.city}, ${city.state} (${city.beach_count} beaches)`);
    });
  } else {
    console.log("newport pattern match: ✗ Not found");
  }

  console.log("\n✅ All tests completed");
}

testCityResolution().catch(console.error);
