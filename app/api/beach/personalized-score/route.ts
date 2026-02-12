import { NextRequest, NextResponse } from 'next/server';
import { withAuth, createSuccessResponse } from '@/lib/middleware/api-wrappers';
import { scoreBeachForUser } from '@/lib/services/personalized-scoring-service';
import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * POST /api/beach/personalized-score
 *
 * Calculates personalized score for a beach based on user preferences
 * Body params:
 *   - beachId: The beach ID
 *   - baseScore: The base algorithmic score
 *   - forecast: Forecast data object
 *
 * Returns:
 *   - score: Personalized score (0-100)
 *   - breakdown: Score breakdown by component
 *   - personalized: Whether personalization was applied
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const body = await request.json();
  const { beachId, baseScore, forecast } = body;

  if (!beachId || !baseScore || !forecast) {
    return NextResponse.json(
      { error: 'Missing required parameters: beachId, baseScore, forecast' },
      { status: 400 }
    );
  }

  // Calculate personalized score
  const personalizedScore = await scoreBeachForUser(
    user.id,
    beachId,
    forecast as EnhancedForecastEntity,
    baseScore
  );

  return createSuccessResponse(personalizedScore);
}, { errorMessage: 'Failed to calculate personalized score' });
