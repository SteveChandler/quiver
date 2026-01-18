import { createClient } from '@supabase/supabase-js';

// Quick operation - just refreshes a materialized view
export const maxDuration = 10;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.rpc('refresh_observable_beaches');

  if (error) {
    console.error('Failed to refresh observable_beaches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    message: 'Refreshed observable_beaches materialized view',
  });
}
