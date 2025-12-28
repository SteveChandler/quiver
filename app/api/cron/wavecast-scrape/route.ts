/**
 * WaveCast Scrape Cron Job API
 * Scrapes expert surf forecasts from wavecast.com/socal/
 * Scheduled to run on Sundays, Tuesdays, and Thursdays at 8 AM PST (4 PM UTC)
 */

import { NextRequest } from 'next/server';
import { getWaveCastService, WaveCastService } from '@/lib/services/wavecast-service';
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
} from '@/lib/api-utils';

interface WaveCastCronResult {
  scrapeSuccess: boolean;
  reportId?: string;
  reportDate?: string;
  parsingConfidence?: number;
  parsingErrors?: string[];
  duration: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * POST - Main cron job endpoint for WaveCast scraping
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    // Only allow running in production to avoid accidental dev/preview execution
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;

    // Allow test mode via query parameter for development
    const { searchParams } = new URL(request.url);
    const testMode = searchParams.get('test') === 'true';

    if (env !== 'production' && !testMode) {
      return createErrorResponse(
        'Forbidden',
        `Cron disabled for environment: ${env}. Use ?test=true for testing.`,
        403
      );
    }

    // Validate cron origin (Vercel Cron header or Bearer secret)
    // Skip validation in test mode
    if (!testMode && !validateCronRequest(request)) {
      return createErrorResponse(
        'Unauthorized',
        'Invalid cron authentication',
        401
      );
    }

    // Initialize WaveCast service
    const wavecastService = getWaveCastService();

    // Check if we should scrape today (Sun/Tue/Thu)
    const shouldScrape = testMode || WaveCastService.shouldScrapeToday();

    if (!shouldScrape) {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      return createSuccessResponse(
        {
          scrapeSuccess: false,
          skipped: true,
          skipReason: `WaveCast only updates on Sundays, Tuesdays, and Thursdays. Today is ${today}.`,
          duration: `${Date.now() - startTime}ms`,
          message: 'Scrape skipped - not a scheduled day',
        } as WaveCastCronResult,
        200
      );
    }

    // Check if we already have a report for today
    const hasReport = await wavecastService.hasReportForToday();
    if (hasReport && !testMode) {
      return createSuccessResponse(
        {
          scrapeSuccess: false,
          skipped: true,
          skipReason: 'Report for today already exists',
          duration: `${Date.now() - startTime}ms`,
          message: 'Scrape skipped - report already exists',
        } as WaveCastCronResult,
        200
      );
    }

    // Perform the scrape
    console.log('🌊 Starting WaveCast scrape...');
    const scrapeResult = await wavecastService.scrapeAndStore();

    if (!scrapeResult.success) {
      return createErrorResponse(
        'Scrape failed',
        {
          error: scrapeResult.error,
          parsingErrors: scrapeResult.parsing_errors,
          duration: `${Date.now() - startTime}ms`,
        },
        500
      );
    }

    const result: WaveCastCronResult = {
      scrapeSuccess: true,
      reportId: scrapeResult.report?.id,
      reportDate: scrapeResult.report?.report_date,
      parsingConfidence: scrapeResult.report?.parsing_confidence,
      parsingErrors: scrapeResult.parsing_errors,
      duration: `${Date.now() - startTime}ms`,
    };

    return createSuccessResponse(
      {
        ...result,
        message: `WaveCast scrape completed successfully${
          scrapeResult.parsing_errors && scrapeResult.parsing_errors.length > 0
            ? " (with warnings)"
            : ""
        }`,
      },
      200
    );
  } catch (error) {
    console.error('❌ WaveCast scrape cron failed:', error);
    return createErrorResponse(
      'WaveCast scrape failed',
      {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`,
      },
      500
    );
  }
}

/**
 * GET - Health check and manual trigger endpoint
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    const { searchParams } = new URL(request.url);
    const testMode = searchParams.get('test') === 'true';

    if (env !== 'production' && !testMode) {
      return createErrorResponse(
        'Forbidden',
        `Health check disabled for environment: ${env}`,
        403
      );
    }

    // Check if manual trigger is requested
    const trigger = searchParams.get('trigger') === 'true';
    if (trigger && testMode) {
      // Manually trigger a scrape (test mode only)
      return POST(request);
    }

    // Basic auth check for GET requests
    if (!testMode && !validateCronRequest(request)) {
      return createErrorResponse(
        'Unauthorized',
        'Invalid cron authentication',
        401
      );
    }

    // Health check
    const wavecastService = getWaveCastService();
    const latestReport = await wavecastService.getLatestReport();
    const recentReports = await wavecastService.getRecentReports(7);

    const today = new Date();
    const dayOfWeek = today.getDay();
    const shouldScrapeToday = dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4;

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'wavecast-scrape',
      schedule: {
        days: ['Sunday', 'Tuesday', 'Thursday'],
        time: '8:00 AM PST (4:00 PM UTC)',
        shouldScrapeToday,
      },
      latestReport: latestReport
        ? {
            id: latestReport.id,
            date: latestReport.report_date,
            confidence: latestReport.parsing_confidence,
            author: latestReport.author,
          }
        : null,
      recentReportsCount: recentReports.length,
      last7Days: recentReports.map((r) => ({
        date: r.report_date,
        confidence: r.parsing_confidence,
      })),
    };

    return createSuccessResponse(
      healthStatus,
      'WaveCast scrape service health check'
    );
  } catch (error) {
    return createErrorResponse(
      'Health check failed',
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}
