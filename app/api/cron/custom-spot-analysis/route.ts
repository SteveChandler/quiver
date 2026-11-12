import { NextResponse } from 'next/server';

import { withObservedCron } from '@/lib/cron/observability';
import { validateCronRequest } from '@/lib/middleware/api-wrappers';
import { processCustomSpotAnalysisBatch } from '@/lib/services/custom-spot-analysis/processor';
import { SupabaseCustomSpotAnalysisStore } from '@/lib/services/custom-spot-analysis/supabase-store';
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handler(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestedBatchSize = Number.parseInt(
    new URL(request.url).searchParams.get('batchSize') ?? '5',
    10
  );
  const batchSize = Number.isFinite(requestedBatchSize) ? requestedBatchSize : 5;

  try {
    const summary = await processCustomSpotAnalysisBatch(
      new SupabaseCustomSpotAnalysisStore(),
      batchSize
    );
    return NextResponse.json({ ok: true, summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'custom_spot_analysis_unavailable' },
      { status: 500 }
    );
  }
}

const handleGet = withObservedCron('/api/cron/custom-spot-analysis', handler);

export const GET = withErrorNoStore(handleGet);
