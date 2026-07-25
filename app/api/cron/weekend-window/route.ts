import { runWeekendScoutCron } from '@/lib/cron/weekend-scout-runner';
import { withObservedCron } from '@/lib/cron/observability';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SENTRY_MONITOR = {
  slug: 'weekend-window',
  schedule: '0 * * * 4-6',
  maxRuntimeMinutes: 5,
};

async function weekendScoutCron(request: Request): Promise<Response> {
  return runWeekendScoutCron(request);
}

export const GET = withObservedCron(
  '/api/cron/weekend-window',
  weekendScoutCron,
  SENTRY_MONITOR,
);
