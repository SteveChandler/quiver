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
export const maxDuration = 30;

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
    .refine((ids) => ids.length <= 30, 'At most 30 candidate beaches are allowed'),
  localTimezone: z.string().min(1).refine(isValidTimezone, 'Invalid IANA timezone'),
  startLocalDate: z.string().refine(isValidLocalDate, 'Invalid local date'),
  dayCount: z.literal(7),
});

async function weekScoutHandler(
  request: NextRequest,
  { user }: AuthenticatedContext,
): Promise<NextResponse> {
  if (process.env.WEEK_SCOUT_ENDPOINT_ENABLED !== 'true') {
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
    candidateBeachIds: parsed.data.candidateBeachIds.slice(0, 8),
  });
  if (
    forecast.recommendationAvailability?.state === 'none'
    && forecast.recommendationAvailability.reasonCode === 'hold_state_unavailable'
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'Recommendations are temporarily unavailable',
        code: 'hold_state_unavailable',
        retryable: true,
      },
      { status: 503 },
    );
  }

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
