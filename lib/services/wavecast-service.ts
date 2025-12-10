/**
 * WaveCast Service
 *
 * Scrapes and processes expert surf forecasts from wavecast.com/socal/
 * Provides integration with the Quiver forecasting system to blend
 * expert predictions with automated model forecasts.
 *
 * Schedule: Updates on Sundays, Tuesdays, and Thursdays at 8 AM PST
 */

import { createClient } from '@supabase/supabase-js';
import { parseWaveCastHTML, extractHazards } from '@/lib/parsers/wavecast-parser';
import {
  WaveCastReport,
  WaveCastScrapeResult,
  WaveCastScraperConfig,
  DEFAULT_WAVECAST_CONFIG,
} from '@/types/wavecast';

export class WaveCastService {
  private readonly config: WaveCastScraperConfig;
  private readonly supabase;

  constructor(config?: Partial<WaveCastScraperConfig>) {
    this.config = {
      ...DEFAULT_WAVECAST_CONFIG,
      ...config,
    };

    // Initialize Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Main scrape function - fetches and stores WaveCast forecast
   */
  async scrapeAndStore(): Promise<WaveCastScrapeResult> {
    console.log('🌊 WaveCast scrape started');

    try {
      // Fetch HTML
      const html = await this.fetchHTML();
      if (!html) {
        return {
          success: false,
          error: 'Failed to fetch HTML from WaveCast',
          scrape_timestamp: new Date().toISOString(),
        };
      }

      console.log(`✅ Fetched ${html.length} characters of HTML`);

      // Parse HTML
      const parseResult = parseWaveCastHTML(html);
      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: 'Failed to parse WaveCast HTML',
          scrape_timestamp: new Date().toISOString(),
          parsing_errors: parseResult.errors,
        };
      }

      console.log(`✅ Parsed WaveCast data with ${parseResult.confidence} confidence`);

      // Extract additional data
      const hazards = extractHazards(html);
      if (hazards.length > 0) {
        parseResult.data.hazards = hazards;
      }

      // Store in database
      const report = await this.storeReport(html, parseResult);

      if (!report) {
        return {
          success: false,
          error: 'Failed to store report in database',
          scrape_timestamp: new Date().toISOString(),
          parsing_errors: parseResult.errors,
        };
      }

      console.log(`✅ Stored WaveCast report with ID: ${report.id}`);

      return {
        success: true,
        report,
        scrape_timestamp: new Date().toISOString(),
        parsing_errors: parseResult.errors.length > 0 ? parseResult.errors : undefined,
      };
    } catch (error) {
      console.error('❌ WaveCast scrape error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        scrape_timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Fetch HTML from WaveCast website
   */
  private async fetchHTML(): Promise<string | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retry_attempts; attempt++) {
      try {
        console.log(`🔄 Fetch attempt ${attempt}/${this.config.retry_attempts}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout_ms);

        const response = await fetch(this.config.url, {
          headers: {
            'User-Agent': this.config.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();

        if (html.length < 500) {
          throw new Error('Response too short, likely not a valid page');
        }

        return html;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Fetch attempt ${attempt} failed:`, lastError.message);

        if (attempt < this.config.retry_attempts) {
          console.log(`⏱️ Waiting ${this.config.retry_delay_ms}ms before retry...`);
          await this.sleep(this.config.retry_delay_ms);
        }
      }
    }

    console.error('❌ All fetch attempts failed:', lastError?.message);
    return null;
  }

  /**
   * Store parsed report in database
   */
  private async storeReport(
    html: string,
    parseResult: ReturnType<typeof parseWaveCastHTML>
  ): Promise<WaveCastReport | null> {
    try {
      const { data, confidence, errors } = parseResult;

      if (!data) {
        throw new Error('No parsed data to store');
      }

      // Extract full text from parsed data
      const fullText = html
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      const reportData = {
        report_date: data.report_date,
        scrape_timestamp: new Date().toISOString(),
        author: data.author,
        full_text: fullText,
        html_content: html,
        parsed_data: data,
        beach_forecasts: data.wave_forecasts || [],
        current_conditions: null, // Will be populated by parser in future
        outlook: null, // Will be populated by parser in future
        parsing_confidence: confidence,
        parsing_errors: errors.length > 0 ? errors : null,
      };

      // Upsert (insert or update if exists for this date)
      const { data: report, error } = await this.supabase
        .from('wavecast_reports')
        .upsert(reportData, {
          onConflict: 'report_date',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      return report as WaveCastReport;
    } catch (error) {
      console.error('❌ Failed to store report:', error);
      return null;
    }
  }

  /**
   * Get latest WaveCast report from database
   */
  async getLatestReport(): Promise<WaveCastReport | null> {
    try {
      const { data, error } = await this.supabase
        .from('wavecast_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Failed to fetch latest report:', error);
        return null;
      }

      return data as WaveCastReport | null;
    } catch (error) {
      console.error('❌ Error fetching latest report:', error);
      return null;
    }
  }

  /**
   * Get WaveCast report for a specific date
   */
  async getReportByDate(date: string): Promise<WaveCastReport | null> {
    try {
      const { data, error } = await this.supabase
        .from('wavecast_reports')
        .select('*')
        .eq('report_date', date)
        .maybeSingle();

      if (error) {
        console.error(`❌ Failed to fetch report for ${date}:`, error);
        return null;
      }

      return data as WaveCastReport | null;
    } catch (error) {
      console.error(`❌ Error fetching report for ${date}:`, error);
      return null;
    }
  }

  /**
   * Get recent WaveCast reports (last N days)
   */
  async getRecentReports(days: number = 7): Promise<WaveCastReport[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('wavecast_reports')
        .select('*')
        .gte('report_date', cutoffDate.toISOString().split('T')[0])
        .order('report_date', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch recent reports:', error);
        return [];
      }

      return (data || []) as WaveCastReport[];
    } catch (error) {
      console.error('❌ Error fetching recent reports:', error);
      return [];
    }
  }

  /**
   * Check if we should scrape today (Sun/Tue/Thu)
   */
  static shouldScrapeToday(): boolean {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 2 = Tuesday, 4 = Thursday
    return dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4;
  }

  /**
   * Check if we already have a report for today
   */
  async hasReportForToday(): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    const report = await this.getReportByDate(today);
    return report !== null;
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for reuse
 */
let wavecastServiceInstance: WaveCastService | null = null;

export function getWaveCastService(
  config?: Partial<WaveCastScraperConfig>
): WaveCastService {
  if (!wavecastServiceInstance) {
    wavecastServiceInstance = new WaveCastService(config);
  }
  return wavecastServiceInstance;
}
