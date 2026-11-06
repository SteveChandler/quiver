import {
  assertSafeCustomSpotBackfillTarget,
  parseCustomSpotBackfillArgs,
} from '@/lib/services/custom-spot-analysis/backfill-config';

describe('custom spot fingerprint backfill safety', () => {
  it('defaults to a bounded dry run', () => {
    expect(parseCustomSpotBackfillArgs([])).toEqual({
      dryRun: true,
      batchSize: 50,
      afterId: null,
    });
  });

  it('supports a resumable cursor and bounded batch', () => {
    expect(parseCustomSpotBackfillArgs([
      '--execute', '--batch-size=25', '--after-id', 'cursor-id',
    ])).toEqual({ dryRun: false, batchSize: 25, afterId: 'cursor-id' });
    expect(() => parseCustomSpotBackfillArgs(['--batch-size=101'])).toThrow('invalid_batch_size');
  });

  it('refuses every non-local execute target including production', () => {
    const options = parseCustomSpotBackfillArgs(['--execute']);
    expect(() => assertSafeCustomSpotBackfillTarget(options, {
      CONFIRM_TARGET: 'PROD',
      SUPABASE_URL: 'https://prod.supabase.co',
    })).toThrow('execute_requires_confirm_target_dev');
    expect(() => assertSafeCustomSpotBackfillTarget(options, {
      CONFIRM_TARGET: 'DEV',
      SUPABASE_URL: 'https://staging.supabase.co',
    })).toThrow('execute_is_limited_to_local_development');
    expect(() => assertSafeCustomSpotBackfillTarget(options, {
      CONFIRM_TARGET: 'DEV',
      SUPABASE_URL: 'http://127.0.0.1:54321',
    })).not.toThrow();
  });
});
