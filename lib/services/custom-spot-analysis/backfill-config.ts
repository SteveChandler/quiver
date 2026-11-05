export interface CustomSpotBackfillOptions {
  dryRun: boolean;
  batchSize: number;
  afterId: string | null;
}

export function parseCustomSpotBackfillArgs(args: string[]): CustomSpotBackfillOptions {
  let dryRun = true;
  let batchSize = 50;
  let afterId: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--execute') {
      dryRun = false;
      continue;
    }
    if (arg === '--batch-size') {
      batchSize = Number.parseInt(args[index + 1] ?? '', 10);
      index += 1;
      continue;
    }
    if (arg.startsWith('--batch-size=')) {
      batchSize = Number.parseInt(arg.slice('--batch-size='.length), 10);
      continue;
    }
    if (arg === '--after-id') {
      afterId = args[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg.startsWith('--after-id=')) {
      afterId = arg.slice('--after-id='.length) || null;
      continue;
    }
    throw new Error(`unknown_argument:${arg}`);
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error('invalid_batch_size');
  }
  return { dryRun, batchSize, afterId };
}

export function assertSafeCustomSpotBackfillTarget(
  options: CustomSpotBackfillOptions,
  environment: Record<string, string | undefined>
): void {
  if (options.dryRun) return;
  if (environment.CONFIRM_TARGET !== 'DEV') {
    throw new Error('execute_requires_confirm_target_dev');
  }

  const rawUrl = environment.SUPABASE_URL ?? environment.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) throw new Error('missing_supabase_url');
  const hostname = new URL(rawUrl).hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error('execute_is_limited_to_local_development');
  }
}
