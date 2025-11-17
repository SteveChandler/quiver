/**
 * Performance Test Script for Recommendations API
 *
 * This script validates that the N+1 query fix is working correctly
 * by testing the recommendations endpoint with different beach counts.
 *
 * Expected Results:
 * - Before fix: ~5-10 seconds for 25 beaches (50 queries)
 * - After fix: <500ms for 25 beaches (2 queries)
 *
 * Usage:
 *   npx tsx scripts/test-recommendations-perf.ts
 */

async function testRecommendationsPerformance() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Test coordinates (San Diego area)
  const testCases = [
    {
      name: 'San Diego (25 beaches)',
      lat: 32.7157,
      lon: -117.1611,
      expectedBeaches: 25,
    },
    {
      name: 'Los Angeles (25 beaches)',
      lat: 34.0522,
      lon: -118.2437,
      expectedBeaches: 25,
    },
  ];

  console.log('🏄 Recommendations API Performance Test\n');
  console.log('Testing N+1 query fix...\n');

  for (const testCase of testCases) {
    console.log(`📍 Testing: ${testCase.name}`);
    console.log(`   Coordinates: ${testCase.lat}, ${testCase.lon}`);

    const startTime = Date.now();

    try {
      const url = `${API_URL}/api/v1/recommendations?lat=${testCase.lat}&lon=${testCase.lon}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}: ${response.statusText}\n`);
        continue;
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      const beachCount = data.data?.recommendations?.length || 0;
      const topPicks = data.data?.top_picks?.length || 0;

      console.log(`   ✅ Response time: ${duration}ms`);
      console.log(`   📊 Beaches analyzed: ${beachCount}`);
      console.log(`   ⭐ Top picks: ${topPicks}`);

      if (duration < 500) {
        console.log(`   🎉 EXCELLENT - Well under 500ms target!`);
      } else if (duration < 1000) {
        console.log(`   ✅ GOOD - Under 1 second`);
      } else if (duration < 3000) {
        console.log(`   ⚠️  ACCEPTABLE - But could be faster`);
      } else {
        console.log(`   ❌ SLOW - Likely still has N+1 issue`);
      }

      // Validate response structure
      if (data.data?.recommendations && Array.isArray(data.data.recommendations)) {
        const sample = data.data.recommendations[0];
        if (sample) {
          const hasRequiredFields =
            sample.spotId &&
            sample.name &&
            sample.score !== undefined &&
            sample.wave &&
            sample.wind &&
            sample.tide;

          if (hasRequiredFields) {
            console.log(`   ✅ Response structure valid`);
          } else {
            console.log(`   ⚠️  Response missing required fields`);
          }
        }
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log('');
  }

  console.log('📝 Expected Performance:');
  console.log('   Before fix: 5-10 seconds (50 queries for 25 beaches)');
  console.log('   After fix:  <500ms (2 queries total)');
  console.log('   Improvement: 10-20x faster 🚀\n');
}

// Run the test
testRecommendationsPerformance().catch(console.error);
