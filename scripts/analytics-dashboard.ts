#!/usr/bin/env tsx
/**
 * Quiver Analytics Dashboard
 * Fetches key metrics from the production database.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🏄 Quiver Analytics Dashboard');
  console.log('Generated:', new Date().toISOString());
  console.log('');

  try {
    // Query 1: Users
    console.log('=== Users ===');
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('created_at, email')
      .not('email', 'ilike', '%test%')
      .not('email', 'like', '%@local.test')
      .not('email', 'like', '%@example.invalid');

    if (usersError) throw usersError;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const totalUsers = users?.length || 0;
    const newUsers7d = users?.filter(u => new Date(u.created_at) >= sevenDaysAgo).length || 0;
    const newUsers24h = users?.filter(u => new Date(u.created_at) >= oneDayAgo).length || 0;

    console.log(JSON.stringify({ totalUsers, newUsers7d, newUsers24h }, null, 2));
    console.log('');

    // Query 2: Sessions (overview)
    console.log('=== Sessions ===');
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: sessions7d } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: sessions24h } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', oneDayAgo.toISOString());

    const { data: sessionsWithRatings } = await supabase
      .from('sessions')
      .select('rating, duration_minutes, user_id, created_at')
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    const activeSurfers7d = new Set(sessionsWithRatings?.map(s => s.user_id) || []).size;
    const avgRating = sessionsWithRatings?.filter(s => s.rating).reduce((sum, s) => sum + s.rating!, 0) / (sessionsWithRatings?.filter(s => s.rating).length || 1);
    const avgDuration = sessionsWithRatings?.filter(s => s.duration_minutes).reduce((sum, s) => sum + s.duration_minutes!, 0) / (sessionsWithRatings?.filter(s => s.duration_minutes).length || 1);

    console.log(JSON.stringify({
      totalSessions,
      sessions7d,
      sessions24h,
      activeSurfers7d,
      avgRating: avgRating.toFixed(2),
      avgDurationMin: Math.round(avgDuration),
    }, null, 2));
    console.log('');

    // Query 3: Content
    console.log('=== Content ===');
    const { count: totalReviews } = await supabase
      .from('beach_reviews')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    const { count: reviews7d } = await supabase
      .from('beach_reviews')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: totalIntel } = await supabase
      .from('intel_posts')
      .select('*', { count: 'exact', head: true });

    const { count: intel7d } = await supabase
      .from('intel_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: totalBoards } = await supabase
      .from('boards')
      .select('*', { count: 'exact', head: true });

    const { count: totalBeaches } = await supabase
      .from('beaches')
      .select('*', { count: 'exact', head: true });

    console.log(JSON.stringify({
      totalReviews,
      reviews7d,
      totalIntel,
      intel7d,
      totalBoards,
      totalBeaches,
    }, null, 2));
    console.log('');

    // Query 4: Email Delivery (7d)
    console.log('=== Email Delivery (7d) ===');
    const { data: emailLogs } = await supabase
      .from('email_send_log')
      .select('email_type')
      .gte('sent_at', sevenDaysAgo.toISOString());

    const emails7d = emailLogs?.length || 0;
    const welcomeEmails = emailLogs?.filter(e => e.email_type === 'welcome').length || 0;
    const forecastDigestEmails = emailLogs?.filter(e => e.email_type === 'forecast_digest').length || 0;
    const reengagementEmails = emailLogs?.filter(e => e.email_type === 'reengagement').length || 0;
    const weeklyRecapEmails = emailLogs?.filter(e => e.email_type === 'weekly_recap').length || 0;

    console.log(JSON.stringify({
      emails7d,
      welcomeEmails,
      forecastDigestEmails,
      reengagementEmails,
      weeklyRecapEmails,
    }, null, 2));
    console.log('');

    // Query 5: User Events (7d)
    console.log('=== User Events (7d) ===');
    const { data: userEvents } = await supabase
      .from('user_events')
      .select('event_type, user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    const totalEvents7d = userEvents?.length || 0;
    const usersWithEvents7d = new Set(userEvents?.map(e => e.user_id) || []).size;
    const pageViews = userEvents?.filter(e => e.event_type === 'page_view').length || 0;
    const beachViews = userEvents?.filter(e => e.event_type === 'beach_view').length || 0;
    const discoveryClicks = userEvents?.filter(e => e.event_type === 'discovery_click').length || 0;
    const discoverySkips = userEvents?.filter(e => e.event_type === 'discovery_skip').length || 0;
    const forecastChecks = userEvents?.filter(e => e.event_type === 'forecast_check').length || 0;
    const sessionActions = userEvents?.filter(e => e.event_type === 'session_action').length || 0;
    const ctaClicks = userEvents?.filter(e => e.event_type === 'cta_click').length || 0;
    const avgEventsPerUser = usersWithEvents7d > 0 ? (totalEvents7d / usersWithEvents7d).toFixed(1) : '0.0';

    console.log(JSON.stringify({
      totalEvents7d,
      usersWithEvents7d,
      pageViews,
      beachViews,
      discoveryClicks,
      discoverySkips,
      forecastChecks,
      sessionActions,
      ctaClicks,
      avgEventsPerUser,
    }, null, 2));
    console.log('');

    // Query 6: Content Creation (7d)
    console.log('=== Content Creation (7d) ===');
    const { count: sessionsCreated7d } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: boardsAdded7d } = await supabase
      .from('boards')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: reviewsWritten7d } = await supabase
      .from('beach_reviews')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: intelPosted7d } = await supabase
      .from('intel_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    console.log(JSON.stringify({
      sessionsCreated7d,
      boardsAdded7d,
      reviewsWritten7d,
      intelPosted7d,
    }, null, 2));
    console.log('');

    // Query 7: Top Beaches (7d)
    console.log('=== Top Beaches (7d) ===');
    const { data: beachViewEvents } = await supabase
      .from('user_events')
      .select('beach_id')
      .eq('event_type', 'beach_view')
      .gte('created_at', sevenDaysAgo.toISOString());

    const beachViewCounts = new Map<string, number>();
    beachViewEvents?.forEach(event => {
      if (event.beach_id) {
        beachViewCounts.set(event.beach_id, (beachViewCounts.get(event.beach_id) || 0) + 1);
      }
    });

    const topBeachIds = Array.from(beachViewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([beachId]) => beachId);

    const { data: topBeaches } = await supabase
      .from('beaches')
      .select('id, name')
      .in('id', topBeachIds);

    const topBeachesWithCounts = topBeachIds.map(id => {
      const beach = topBeaches?.find(b => b.id === id);
      return {
        beach_name: beach?.name || 'Unknown',
        view_count: beachViewCounts.get(id) || 0,
      };
    });

    console.log(JSON.stringify(topBeachesWithCounts, null, 2));
    console.log('');

    // Query 8: Daily Active Users (7d)
    console.log('=== Daily Active Users (7d) ===');
    const { data: dailyEvents } = await supabase
      .from('user_events')
      .select('created_at, user_id')
      .gte('created_at', sevenDaysAgo.toISOString());

    const dailyActiveUsers = new Map<string, Set<string>>();
    dailyEvents?.forEach(event => {
      const day = event.created_at.split('T')[0];
      if (!dailyActiveUsers.has(day)) {
        dailyActiveUsers.set(day, new Set());
      }
      dailyActiveUsers.get(day)!.add(event.user_id);
    });

    const dauByDay = Array.from(dailyActiveUsers.entries())
      .map(([day, users]) => ({
        day,
        active_users: users.size,
      }))
      .sort((a, b) => b.day.localeCompare(a.day));

    console.log(JSON.stringify(dauByDay, null, 2));
    console.log('');

    console.log('✅ Analytics dashboard complete');
  } catch (error) {
    console.error('Error fetching analytics:', error);
    process.exit(1);
  }
}

main();
