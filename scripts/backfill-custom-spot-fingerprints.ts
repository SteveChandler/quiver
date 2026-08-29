#!/usr/bin/env node

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

import {
  assertSafeCustomSpotBackfillTarget,
  parseCustomSpotBackfillArgs,
} from '../lib/services/custom-spot-analysis/backfill-config';
import { CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION } from '../lib/services/custom-spot-analysis/core';

interface BackfillRow {
  id: string;
  terrain_status: string | null;
  fingerprint_provenance_state: string;
  fingerprint_model_version: string | null;
}

config({ path: '.env.local' });

async function main(): Promise<void> {
  const options = parseCustomSpotBackfillArgs(process.argv.slice(2));
  assertSafeCustomSpotBackfillTarget(options, process.env);

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('missing_supabase_configuration');
  const client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as SupabaseClient;

  let query = client
    .from('custom_spots')
    .select('id, terrain_status, fingerprint_provenance_state, fingerprint_model_version')
    .is('deleted_at', null)
    .or(`fingerprint_model_version.is.null,fingerprint_model_version.neq.${CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION},terrain_status.in.(failed,queued)`)
    .order('id', { ascending: true })
    .limit(options.batchSize);
  if (options.afterId) query = query.gt('id', options.afterId);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as BackfillRow[];
  const stateCounts = rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.fingerprint_provenance_state] = (counts[row.fingerprint_provenance_state] ?? 0) + 1;
    return counts;
  }, {});

  if (!options.dryRun && rows.length > 0) {
    const jobs = rows.map((row) => ({
      custom_spot_id: row.id,
      requested_model_version: CUSTOM_SPOT_FINGERPRINT_MODEL_VERSION,
      status: 'queued',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      locked_at: null,
      last_error_code: null,
      updated_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await client
      .from('custom_spot_analysis_jobs')
      .upsert(jobs, { onConflict: 'custom_spot_id' });
    if (upsertError) throw upsertError;
  }

  console.log(JSON.stringify({
    mode: options.dryRun ? 'dry-run' : 'execute',
    selected: rows.length,
    stateCounts,
    hasMore: rows.length === options.batchSize,
    nextCursor: rows.at(-1)?.id ?? null,
  }));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const code = error instanceof Error ? error.message.split(':')[0] : 'backfill_failed';
    console.error(JSON.stringify({ ok: false, error: code }));
    process.exitCode = 1;
  });
}
