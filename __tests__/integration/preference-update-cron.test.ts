/**
 * Integration tests for Preference Update Cron Job
 *
 * Purpose: Test the end-to-end preference update cron job flow with
 * real database interactions and service role authentication
 *
 * Tests:
 * - Complete cron execution with real user data
 * - Batch processing with multiple users
 * - Error handling with mixed success/failure scenarios
 * - Health check endpoint functionality
 * - Authentication and authorization
 *
 * @jest-environment node
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Ensure fetch is available for API tests
// Node.js 18+ has fetch built-in, but Jest might not expose it
// @ts-ignore
if (typeof global.fetch === 'undefined' && typeof fetch !== 'undefined') {
  // @ts-ignore
  global.fetch = fetch;
} else if (typeof global.fetch === 'undefined') {
  // Fallback: try to use node-fetch if available
  try {
    // @ts-ignore
    global.fetch = require('node-fetch');
  } catch {
    // If node-fetch is not available, create a simple mock
    // @ts-ignore
    global.fetch = async (url: string, options?: any) => {
      const http = require('http');
      const https = require('https');
      const { URL } = require('url');
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      return new Promise((resolve, reject) => {
        const req = client.request(urlObj, options || {}, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => { data += chunk; });
          res.on('end', () => {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              json: async () => JSON.parse(data),
              text: async () => data,
            } as Response);
          });
        });
        req.on('error', reject);
        if (options?.body) {
          req.write(options.body);
        }
        req.end();
      });
    };
  }
}

describe('Preference Update Cron Integration', () => {
  let supabaseAdmin: ReturnType<typeof createClient<Database>>;
  let testUserIds: string[] = [];
  let testBeachId: string;

  beforeAll(async () => {
    if (!supabaseServiceKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY not set. Required for integration tests.'
      );
    }

    if (!cronSecret) {
      console.warn(
        '⚠️ CRON_SECRET_TOKEN not set. Some tests may fail authentication.'
      );
    }

    supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Create a test beach for session snapshots
    const { data: beachData, error: beachError } = await supabaseAdmin
      .from('beaches')
      .select('id')
      .limit(1)
      .single();

    if (beachError || !beachData) {
      throw new Error('No beaches found in database for testing');
    }

    testBeachId = beachData.id;

    // Create 3 test users with varying amounts of rated sessions
    for (let i = 0; i < 3; i++) {
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.createUser({
          email: `pref-cron-test-${Date.now()}-${i}@test.com`,
          password: 'test-password-123',
          email_confirm: true,
        });

      if (userError || !userData.user) {
        throw new Error(`Failed to create test user ${i}: ${userError?.message}`);
      }

      testUserIds.push(userData.user.id);

      // Create rated sessions with forecast snapshots for each user
      const sessionCount = i === 0 ? 3 : i === 1 ? 8 : 15; // Varying sample sizes

      for (let j = 0; j < sessionCount; j++) {
        // Create session
        const { data: sessionData, error: sessionError } = await supabaseAdmin
          .from('sessions')
          .insert({
            user_id: userData.user.id,
            beach_id: testBeachId,
            arrival_time: new Date(Date.now() - j * 86400000).toISOString(), // Stagger dates
            status: 'completed',
            rating: j % 2 === 0 ? 4 : 5, // Mix of good ratings (4-5)
          })
          .select()
          .single();

        if (sessionError || !sessionData) {
          console.warn(`Failed to create session ${j} for user ${i}`);
          continue;
        }

        // Create forecast snapshot
        const forecastSnapshot = {
          wave_height: 3.0 + Math.random() * 3.0,
          wave_period: 10.0 + Math.random() * 5.0,
          wind_speed: 5.0 + Math.random() * 10.0,
          wind_direction: Math.floor(Math.random() * 360),
          tide_status: ['rising', 'falling', 'high', 'low'][Math.floor(Math.random() * 4)],
          confidence_score: 80,
          data_source: 'CDIP',
        };

        const actualConditions = {
          rating: sessionData.rating,
          wave_quality: sessionData.rating >= 4 ? 'good' : 'fair',
          water_temp: 65,
          crowd_level: 'moderate',
        };

        // Parse arrival_time safely
        const arrivalTime = sessionData.arrival_time 
          ? (typeof sessionData.arrival_time === 'string' 
              ? new Date(sessionData.arrival_time) 
              : new Date(sessionData.arrival_time))
          : new Date();
        
        if (isNaN(arrivalTime.getTime())) {
          console.warn(`Invalid arrival_time for session ${sessionData.id}: ${sessionData.arrival_time}`);
          continue;
        }
        
        await supabaseAdmin.from('session_forecast_snapshots').insert({
          session_id: sessionData.id,
          user_id: userData.user.id,
          beach_id: testBeachId,
          forecast_snapshot: forecastSnapshot,
          actual_conditions: actualConditions,
          forecast_confidence_score: 80,
          data_source: 'CDIP',
          session_date: arrivalTime.toISOString().split('T')[0],
        });
      }
    }

    console.log(
      `✅ Created ${testUserIds.length} test users with sessions (3, 8, 15 sessions each)`
    );
  });

  afterAll(async () => {
    // Clean up all test data
    for (const userId of testUserIds) {
      // Delete preferences
      await supabaseAdmin
        .from('user_surf_preferences')
        .delete()
        .eq('user_id', userId);

      // Delete sessions (cascade should handle snapshots)
      await supabaseAdmin.from('sessions').delete().eq('user_id', userId);

      // Delete user
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }

    console.log('✅ Cleaned up test users and data');
  });

  describe('POST /api/cron/update-user-preferences', () => {
    beforeEach(async () => {
      // Clean up any existing preferences before each test
      for (const userId of testUserIds) {
        await supabaseAdmin
          .from('user_surf_preferences')
          .delete()
          .eq('user_id', userId);
      }
    });

    it('should successfully process eligible users and update preferences', async () => {
      if (!cronSecret) {
        console.log('⚠️ Skipping: CRON_SECRET_TOKEN not set');
        return;
      }

      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      const data = await response.json();

      // In test environment, this may return 403 (Forbidden) if not production
      if (response.status === 403) {
        expect(data.error).toContain('Forbidden');
        expect(data.details).toMatch(/environment|production/i);
        console.log('ℹ️ Cron disabled for non-production environment (expected)');
        return;
      }

      // If it runs, validate the response
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        totalUsers: expect.any(Number),
        successful: expect.any(Number),
        failed: expect.any(Number),
        skipped: expect.any(Number),
        duration: expect.stringMatching(/^\d+ms$/),
        failures: expect.any(Array),
      });

      console.log('✅ Cron execution summary:', data.data);
    }, 30000); // 30s timeout for full execution

    it('should skip users with insufficient data (<5 rated sessions)', async () => {
      if (!cronSecret) {
        console.log('⚠️ Skipping: CRON_SECRET_TOKEN not set');
        return;
      }

      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      if (response.status === 403) {
        console.log('ℹ️ Cron disabled for non-production environment (expected)');
        return;
      }

      const data = await response.json();

      // User 0 has 3 sessions (should be skipped)
      // User 1 has 8 sessions (should succeed)
      // User 2 has 15 sessions (should succeed)
      expect(data.data.skipped).toBeGreaterThan(0);

      console.log(
        `✅ Skipped ${data.data.skipped} users with insufficient data`
      );
    }, 30000);

    it('should create preference records in database', async () => {
      if (!cronSecret) {
        console.log('⚠️ Skipping: CRON_SECRET_TOKEN not set');
        return;
      }

      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      if (response.status === 403) {
        console.log('ℹ️ Cron disabled for non-production environment (expected)');
        return;
      }

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check database for created preferences
      const { data: preferences, error } = await supabaseAdmin
        .from('user_surf_preferences')
        .select('*')
        .in('user_id', testUserIds);

      expect(error).toBeNull();

      // At least users with 5+ sessions should have preferences
      // (User 1: 8 sessions, User 2: 15 sessions)
      expect(preferences?.length).toBeGreaterThan(0);

      if (preferences && preferences.length > 0) {
        const pref = preferences[0];
        expect(pref).toMatchObject({
          user_id: expect.any(String),
          confidence: expect.any(Number),
          sample_size: expect.any(Number),
        });

        console.log(`✅ Created ${preferences.length} preference records`);
      }
    }, 30000);

    it('should reject requests without authentication', async () => {
      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {},
      });

      expect([401, 403]).toContain(response.status);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject requests with invalid token', async () => {
      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid-token-12345',
        },
      });

      expect([401, 403]).toContain(response.status);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/cron/update-user-preferences', () => {
    it('should return health status', async () => {
      if (!cronSecret) {
        console.log('⚠️ Skipping: CRON_SECRET_TOKEN not set');
        return;
      }

      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      // May return 403 in non-production environments
      if (response.status === 403) {
        console.log('ℹ️ Health check disabled for non-production environment');
        return;
      }

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded)$/),
        timestamp: expect.any(String),
        services: {
          database: expect.any(Boolean),
          preferencesTable: expect.any(Boolean),
        },
        stats: {
          totalPreferences: expect.any(Number),
        },
      });

      console.log('✅ Health check status:', data.data.status);
    });

    it('should reject health check without authentication', async () => {
      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'GET',
        headers: {},
      });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    it('should complete processing within reasonable time', async () => {
      if (!cronSecret) {
        console.log('⚠️ Skipping: CRON_SECRET_TOKEN not set');
        return;
      }

      const startTime = Date.now();

      const response = await fetch(`${baseUrl}/api/cron/update-user-preferences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      const duration = Date.now() - startTime;

      if (response.status === 403) {
        console.log('ℹ️ Cron disabled for non-production environment');
        return;
      }

      // Should complete within 30 seconds for 3 test users
      expect(duration).toBeLessThan(30000);

      const data = await response.json();
      console.log(`✅ Cron completed in ${data.data.duration} (wall clock: ${duration}ms)`);
    }, 30000);
  });
});
