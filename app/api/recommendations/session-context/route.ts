import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/api-wrappers';
import {
  RecommendationSessionContextSchema,
  toRecommendationSessionContextRow,
} from '@/lib/recommendations/session-context';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (
  request: NextRequest,
  { user, supabase },
) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = RecommendationSessionContextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid recommendation context' },
      { status: 400 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id,user_id')
    .eq('id', parsed.data.sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { success: false, error: sessionError.message },
      { status: 500 },
    );
  }

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Session not found' },
      { status: 404 },
    );
  }

  const untypedSupabase = supabase as unknown as {
    from: (table: string) => {
      upsert: (
        payload: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { error } = await untypedSupabase
    .from('recommendation_session_contexts')
    .upsert(toRecommendationSessionContextRow(parsed.data, user.id), {
      onConflict: 'user_id,session_id,recommendation_id',
    });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
});
