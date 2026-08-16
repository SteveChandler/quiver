import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createSuccessResponse,
  createValidationError,
  withAuth,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { generateWeekScoutForecast } from '@/lib/services/discovery/week-scout';

export const dynamic = 'force-dynamic';

/**
 * Request-size and timeout budget.
 *
 * Measured 2026-07-29 against production data, after the Week Scout hot-path
 * fix removed the per-candidate Intl.DateTimeFormat cost:
 *
 *   candidates |  1     8      20     40
 *   before     |  633ms 2002ms 4295ms 8214ms   (~195ms marginal per beach)
 *   after      |  199ms  305ms  532ms  786ms   (~15ms marginal per beach)
 *
 * MAX_CANDIDATE_BEACHES matches WEEK_SCOUT_MAX_CANDIDATES in quiver-native, so
 * a well-behaved client is never rejected. At that ceiling the scoring work is
 * well under a second, which leaves maxDuration as pure headroom for cold
 * starts and slow upstream reads rather than a limit the happy path approaches.
 */
export const maxDuration = 30;

const MAX_CANDIDATE_BEACHES = 30;

/**
 * Ceiling on beaches actually scored, from the 2026-07-26 latency hotfix
 * (d7a4fd3bf). It predates the hot-path fix above and is no longer required to
 * stay inside maxDuration. Raising it toward MAX_CANDIDATE_BEACHES changes
 * which spots appear in a user's week, so it belongs in a behaviour change with
 * its own verification — not in this performance pass.
 */
const MAX_SCORED_BEACHES = 8;

function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
  );
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const WeekScoutRequestSchema = z.object({
  candidateBeachIds: z
    .array(z.string().uuid())
    .min(1)
    .transform((ids) => Array.from(new Set(ids)))
    .refine(
      (ids) => ids.length <= MAX_CANDIDATE_BEACHES,
      `At most ${MAX_CANDIDATE_BEACHES} candidate beaches are allowed`,
    ),
  localTimezone: z.string().min(1).refine(isValidTimezone, 'Invalid IANA timezone'),
  startLocalDate: z.string().refine(isValidLocalDate, 'Invalid local date'),
  dayCount: z.literal(7),
});

async function weekScoutHandler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  // Installed native clients need a stable canonical contract. Keep the flag
  // as an emergency kill switch, but default the endpoint on so an omitted
  // preview/production env value cannot turn every mobile forecast into a 404.
  if (process.env.WEEK_SCOUT_ENDPOINT_ENABLED === 'false') {
    return NextResponse.json(
      { success: false, error: 'Week Scout endpoint is not enabled' },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createValidationError('Invalid JSON body');
  }

  const parsed = WeekScoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return createValidationError('Invalid Week Scout request', parsed.error.flatten());
  }

  const forecast = await generateWeekScoutForecast(user.id, {
    ...parsed.data,
    candidateBeachIds: parsed.data.candidateBeachIds.slice(0, MAX_SCORED_BEACHES),
  });
  return createSuccessResponse(forecast);
}

const protectedPOST = withRateLimit(
  withAuth(weekScoutHandler, { errorMessage: 'Error generating Week Scout forecast' }),
  'surf-discovery',
);

export const POST = async (
  ...args: Parameters<typeof protectedPOST>
): Promise<NextResponse> => {
  const response = await protectedPOST(...args);
  response.headers.delete('ETag');
  response.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate',
  );
  return response;
};
