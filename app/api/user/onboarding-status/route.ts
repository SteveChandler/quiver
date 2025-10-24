import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ completed: false }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Failed to get onboarding status:', error);
    return NextResponse.json({ completed: false }, { status: 500 });
  }

  return NextResponse.json({ completed: !!data.onboarding_completed_at });
}
