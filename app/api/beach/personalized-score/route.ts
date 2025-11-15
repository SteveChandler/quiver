import { NextRequest, NextResponse } from 'next/server';
import { createAPIServerClient } from '@/lib/supabase/server';
import { scoreBeachForUser } from '@/lib/services/personalized-scoring-service';
import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * GET /api/beach/personalized-score
 *
 * Calculates personalized score for a beach based on user preferences
 * Query params:
 *   - beachId: The beach ID
 *   - baseScore: The base algorithmic score
 *   - forecast: Stringified forecast data
 *
 * Returns:
 *   - score: Personalized score (0-100)
 *   - breakdown: Score breakdown by component
 *   - personalized: Whether personalization was applied
 */
export async function POST(request: NextRequest) {
  const supabase = createAPIServerClient();

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
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

    return NextResponse.json({
      data: personalizedScore
    });
  } catch (error) {
    console.error('Exception in personalized-score API:', error);
    return NextResponse.json(
      { error: 'Failed to calculate personalized score' },
      { status: 500 }
    );
  }
}
