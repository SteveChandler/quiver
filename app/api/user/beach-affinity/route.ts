import { NextRequest, NextResponse } from 'next/server';
import { createAPIServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/beach-affinity
 *
 * Retrieves the user's affinity data for a specific beach
 * Query params:
 *   - beachId: The beach ID to get affinity for
 *
 * Returns:
 *   - sessionCount: Number of times user has surfed this beach
 *   - lastSurfed: Date of last session
 *   - affinityScore: Calculated affinity score
 */
export async function GET(request: NextRequest) {
  const supabase = createAPIServerClient();

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get beach ID from query params
  const searchParams = request.nextUrl.searchParams;
  const beachId = searchParams.get('beachId');

  if (!beachId) {
    return NextResponse.json(
      { error: 'Missing beachId parameter' },
      { status: 400 }
    );
  }

  try {
    // Query user_beach_affinity table
    const { data: affinity, error } = await supabase
      .from('user_beach_affinity')
      .select('affinity_score, session_count, last_surfed_at')
      .eq('user_id', user.id)
      .eq('beach_id', beachId)
      .single();

    if (error) {
      // If no affinity record exists, user hasn't surfed here
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          data: {
            sessionCount: 0,
            lastSurfed: null,
            affinityScore: 0,
          }
        });
      }

      console.error('Failed to get beach affinity:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve affinity data' },
        { status: 500 }
      );
    }

    // Return affinity data
    return NextResponse.json({
      data: {
        sessionCount: affinity.session_count || 0,
        lastSurfed: affinity.last_surfed_at ? new Date(affinity.last_surfed_at) : null,
        affinityScore: affinity.affinity_score || 0,
      }
    });
  } catch (error) {
    console.error('Exception in beach-affinity API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
