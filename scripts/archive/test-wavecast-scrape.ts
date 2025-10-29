/**
 * Test script for WaveCast scraping
 * Run with: tsx scripts/test-wavecast-scrape.ts
 */

import { config } from 'dotenv';
import { getWaveCastService, WaveCastService } from '../lib/services/wavecast-service';
import { parseWaveCastHTML } from '../lib/parsers/wavecast-parser';

// Load environment variables
config();

interface TestOptions {
  skipSave?: boolean;
  verbose?: boolean;
}

async function testWaveCastScrape(options: TestOptions = {}) {
  const { skipSave = false, verbose = true } = options;

  console.log('🧪 WaveCast Scrape Test');
  console.log('='.repeat(50));
  console.log();

  // Check environment variables
  console.log('📋 Environment Check:');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
    process.exit(1);
  }

  console.log('   ✓ Supabase URL configured');
  console.log('   ✓ Service role key configured');
  console.log();

  // Initialize service
  console.log('🔧 Initializing WaveCast service...');
  const wavecastService = getWaveCastService();
  console.log('   ✓ Service initialized');
  console.log();

  // Check schedule
  console.log('📅 Schedule Check:');
  const shouldScrape = WaveCastService.shouldScrapeToday();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  console.log(`   Today: ${dayName} (${today.toISOString().split('T')[0]})`);
  console.log(`   Should scrape today: ${shouldScrape ? '✓ Yes' : '✗ No (Sun/Tue/Thu only)'}`);
  console.log();

  // Check if report already exists for today
  console.log('📊 Database Check:');
  const hasReportToday = await wavecastService.hasReportForToday();
  console.log(`   Report exists for today: ${hasReportToday ? '✓ Yes' : '✗ No'}`);

  if (hasReportToday) {
    console.log();
    console.log('ℹ️  Fetching existing report...');
    const existingReport = await wavecastService.getReportByDate(
      today.toISOString().split('T')[0]
    );

    if (existingReport) {
      console.log('   ✓ Found existing report:');
      console.log(`     - ID: ${existingReport.id}`);
      console.log(`     - Date: ${existingReport.report_date}`);
      console.log(`     - Author: ${existingReport.author}`);
      console.log(`     - Confidence: ${existingReport.parsing_confidence}`);
      console.log(`     - Text length: ${existingReport.full_text.length} chars`);

      if (existingReport.parsing_errors && existingReport.parsing_errors.length > 0) {
        console.log('     ⚠️  Parsing errors:');
        existingReport.parsing_errors.forEach((err) => {
          console.log(`       - ${err}`);
        });
      }
    }
  }

  console.log();

  // Fetch recent reports
  console.log('📚 Recent Reports (last 7 days):');
  const recentReports = await wavecastService.getRecentReports(7);

  if (recentReports.length === 0) {
    console.log('   ℹ️  No recent reports found');
  } else {
    recentReports.forEach((report) => {
      console.log(`   - ${report.report_date}: confidence ${report.parsing_confidence} (${report.author})`);
    });
  }

  console.log();

  // Test scraping
  if (skipSave) {
    console.log('⏭️  Skipping scrape (skipSave=true)');
  } else {
    console.log('🌐 Testing scrape...');
    console.log('   URL: https://wavecast.com/socal/');
    console.log();

    const startTime = Date.now();
    const result = await wavecastService.scrapeAndStore();
    const duration = Date.now() - startTime;

    console.log(`   Duration: ${duration}ms`);
    console.log();

    if (result.success && result.report) {
      console.log('✅ Scrape successful!');
      console.log();
      console.log('   Report Details:');
      console.log(`   - ID: ${result.report.id}`);
      console.log(`   - Date: ${result.report.report_date}`);
      console.log(`   - Author: ${result.report.author}`);
      console.log(`   - Confidence: ${result.report.parsing_confidence}`);
      console.log(`   - Scrape time: ${result.report.scrape_timestamp}`);
      console.log(`   - Full text length: ${result.report.full_text.length} chars`);
      console.log();

      if (verbose && result.report.parsed_data) {
        console.log('   Parsed Data Summary:');
        const parsed = result.report.parsed_data as any;
        console.log(`   - Swells found: ${parsed.swells?.length || 0}`);
        console.log(`   - Wave forecasts: ${parsed.wave_forecasts?.length || 0}`);
        console.log(`   - Weather: ${parsed.weather?.wind_pattern || 'Not detected'}`);
        console.log(`   - Water temp: ${parsed.water_temp?.current || 'Not detected'}°F`);
        console.log(`   - Summary: ${parsed.summary?.slice(0, 100)}...`);
        console.log();
      }

      if (result.parsing_errors && result.parsing_errors.length > 0) {
        console.log('   ⚠️  Parsing Warnings:');
        result.parsing_errors.forEach((err) => {
          console.log(`   - ${err}`);
        });
        console.log();
      }
    } else {
      console.log('❌ Scrape failed!');
      console.log();
      console.log(`   Error: ${result.error}`);

      if (result.parsing_errors && result.parsing_errors.length > 0) {
        console.log();
        console.log('   Parsing Errors:');
        result.parsing_errors.forEach((err) => {
          console.log(`   - ${err}`);
        });
      }
      console.log();
    }
  }

  console.log('='.repeat(50));
  console.log('✨ Test complete!');
}

// Parse command line arguments
const args = process.argv.slice(2);
const skipSave = args.includes('--skip-save');
const quiet = args.includes('--quiet');

// Run test
testWaveCastScrape({
  skipSave,
  verbose: !quiet,
}).catch((error) => {
  console.error('💥 Test failed with error:');
  console.error(error);
  process.exit(1);
});
