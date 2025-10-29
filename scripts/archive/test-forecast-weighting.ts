/**
 * Test script for forecast weighting service
 * Run with: npx tsx scripts/test-forecast-weighting.ts
 */

import { config } from 'dotenv';
import { getForecastWeightingService } from '../lib/services/forecast-weighting-service';

// Load environment variables
config();

async function testForecastWeighting() {
  console.log('🧪 Forecast Weighting Service Test');
  console.log('='.repeat(50));
  console.log();

  // Check environment variables
  console.log('📋 Environment Check:');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  console.log('   ✓ Supabase configured');
  console.log();

  // Initialize service
  console.log('🔧 Initializing weighting service...');
  const weightingService = getForecastWeightingService();
  console.log('   ✓ Service initialized');
  console.log();

  // Check expert data availability
  console.log('📊 Checking expert data...');
  const stats = await weightingService.getExpertDataStats();
  console.log(`   Recent data available: ${stats.hasRecentData ? '✓ Yes' : '✗ No'}`);
  console.log(`   Latest report: ${stats.latestReportDate || 'None'}`);
  console.log(`   Reports in last 7 days: ${stats.reportsLast7Days}`);
  console.log();

  // Test forecast blending
  console.log('🌊 Testing forecast blending...');
  console.log();

  // Test 1: Automated forecast without expert data (future date)
  console.log('Test 1: Future forecast (no expert data)');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);

  const automatedForecast1 = {
    wave_height_ft: 5.0,
    wave_period_s: 12.0,
    wave_direction_deg: 315,
    wind_speed_mph: 8,
    wind_direction_deg: 45,
    confidence: 0.7,
  };

  const blended1 = await weightingService.blendForecast(
    automatedForecast1,
    'Pacific Beach',
    futureDate
  );

  console.log('   Input:', automatedForecast1);
  console.log('   Output:', blended1);
  console.log('   Blend ratio:', blended1.blend_ratio);
  console.log();

  // Test 2: Automated forecast with expert data (today/recent)
  console.log('Test 2: Recent forecast (with expert data)');
  const recentDate = new Date('2025-10-28'); // Date of our scraped report

  const automatedForecast2 = {
    wave_height_ft: 4.5,
    wave_period_s: 14.0,
    wave_direction_deg: 310,
    wind_speed_mph: 5,
    wind_direction_deg: 50,
    confidence: 0.75,
  };

  const blended2 = await weightingService.blendForecast(
    automatedForecast2,
    'La Jolla Shores',
    recentDate
  );

  console.log('   Input:', automatedForecast2);
  console.log('   Output:', blended2);
  console.log('   Blend ratio:', blended2.blend_ratio);
  console.log();

  // Calculate adjustments
  const heightChange = ((blended2.wave_height_ft - automatedForecast2.wave_height_ft) / automatedForecast2.wave_height_ft) * 100;
  const periodChange = ((blended2.wave_period_s - automatedForecast2.wave_period_s) / automatedForecast2.wave_period_s) * 100;
  const confidenceChange = ((blended2.confidence - automatedForecast2.confidence) / automatedForecast2.confidence) * 100;

  console.log('📈 Adjustments Applied:');
  console.log(`   Wave Height: ${heightChange > 0 ? '+' : ''}${heightChange.toFixed(1)}%`);
  console.log(`   Wave Period: ${periodChange > 0 ? '+' : ''}${periodChange.toFixed(1)}%`);
  console.log(`   Confidence: ${confidenceChange > 0 ? '+' : ''}${confidenceChange.toFixed(1)}%`);
  console.log();

  // Test 3: Batch blending
  console.log('Test 3: Batch forecast blending');
  const forecasts = [
    { forecast: automatedForecast1, beachName: 'Pacific Beach', date: recentDate },
    { forecast: automatedForecast2, beachName: 'La Jolla Shores', date: recentDate },
    {
      forecast: {
        wave_height_ft: 3.0,
        wave_period_s: 10.0,
        wave_direction_deg: 270,
        confidence: 0.6,
      },
      beachName: 'Mission Beach',
      date: recentDate
    },
  ];

  const batchResults = await weightingService.blendMultipleForecasts(forecasts);

  console.log(`   Processed ${batchResults.length} forecasts:`);
  batchResults.forEach((result, i) => {
    console.log(`   ${i + 1}. ${forecasts[i].beachName}:`);
    console.log(`      Height: ${forecasts[i].forecast.wave_height_ft}ft → ${result.wave_height_ft.toFixed(1)}ft`);
    console.log(`      Expert blend: ${result.blend_ratio?.expert.toFixed(1) || 0}%`);
  });
  console.log();

  // Validation checks
  console.log('✅ Validation Results:');
  const checks = [
    {
      name: 'Expert data available',
      pass: stats.hasRecentData,
    },
    {
      name: 'Future forecasts unchanged',
      pass: blended1.blend_ratio?.expert === 0,
    },
    {
      name: 'Recent forecasts adjusted',
      pass: blended2.blend_ratio && blended2.blend_ratio.expert > 0,
    },
    {
      name: 'Confidence improved',
      pass: blended2.confidence > automatedForecast2.confidence,
    },
    {
      name: 'Adjustments within range (±20%)',
      pass: Math.abs(heightChange) <= 20 && Math.abs(periodChange) <= 20,
    },
    {
      name: 'Batch processing works',
      pass: batchResults.length === forecasts.length,
    },
  ];

  checks.forEach(check => {
    console.log(`   ${check.pass ? '✓' : '✗'} ${check.name}`);
  });

  const allPassed = checks.every(c => c.pass);
  console.log();
  console.log('='.repeat(50));
  console.log(allPassed ? '✅ All tests passed!' : '⚠️  Some tests failed');

  if (!allPassed) {
    process.exit(1);
  }
}

// Run test
testForecastWeighting().catch((error) => {
  console.error('💥 Test failed with error:');
  console.error(error);
  process.exit(1);
});
