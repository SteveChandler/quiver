export type ErrorCategory =
  | 'chunk_load'
  | 'network'
  | 'data_parsing'
  | 'rendering'
  | 'user_input'
  | 'system'
  | 'unknown';

/**
 * Detect chunk load errors caused by stale deployments.
 * Shared by the global ChunkErrorHandler and categorizeError().
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  if (error.name === 'ChunkLoadError') return true;

  const msg = error.message.toLowerCase();
  return (
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('/_next/static/chunks/')
  );
}

/**
 * Categorize error type
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Chunk load errors (stale deployments)
  if (isChunkLoadError(error)) {
    return 'chunk_load';
  }

  // Network errors
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    errorName.includes('networkerror')
  ) {
    return 'network';
  }

  // Data parsing errors
  if (
    message.includes('json') ||
    message.includes('parse') ||
    message.includes('validation') ||
    message.includes('schema') ||
    errorName.includes('syntaxerror')
  ) {
    return 'data_parsing';
  }

  // Rendering errors
  if (
    message.includes('render') ||
    message.includes('hydration') ||
    message.includes('undefined') ||
    message.includes('null') ||
    errorName.includes('typeerror') ||
    errorName.includes('referenceerror')
  ) {
    return 'rendering';
  }

  // User input errors
  if (
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('required')
  ) {
    return 'user_input';
  }

  // System errors
  if (
    message.includes('memory') ||
    message.includes('storage') ||
    message.includes('quota') ||
    errorName.includes('rangeerror')
  ) {
    return 'system';
  }

  return 'unknown';
}
