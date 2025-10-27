/**
 * Native TypeScript debounce implementation
 * Replaces lodash.debounce to reduce bundle size by ~4.9MB
 *
 * @param fn - Function to debounce
 * @param ms - Delay in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Parameters<T>): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, ms);
  };

  // Add cancel method for cleanup (used in useEffect cleanup)
  debounced.cancel = () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return debounced;
}
