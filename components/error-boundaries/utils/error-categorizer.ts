export type ErrorCategory =
  | 'network'
  | 'data_parsing'
  | 'rendering'
  | 'user_input'
  | 'system'
  | 'unknown';

/**
 * Categorize error type
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

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
