/**
 * Seconds a client should wait before retrying a retryable 503/504. The spread keeps
 * clients that failed together from retrying together and re-saturating the database.
 */
export function retryAfterSeconds(random: () => number = Math.random): number {
  return 3 + Math.floor(random() * 4);
}
