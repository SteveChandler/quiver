/**
 * Utility for consistent error handling across server actions
 */

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Higher-order function that wraps server actions with consistent error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error(`Error in ${errorContext}:`, error);
    const errorMessage =
      error instanceof Error ? error.message : `Failed to ${errorContext}`;
    return { success: false, error: errorMessage };
  }
}

/**
 * Helper to handle Supabase response errors
 */
export function handleSupabaseError(error: any, context: string): never {
  console.error(`Supabase error in ${context}:`, error);
  throw new Error(error.message || `Database error in ${context}`);
}
