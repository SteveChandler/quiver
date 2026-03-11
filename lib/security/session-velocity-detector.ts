const MAX_ENTRIES = 5000;
const VELOCITY_WINDOW_MS = 3000; // 3 seconds
const VELOCITY_THRESHOLD = 6; // >6 events in 3s = bot

interface SessionEntry {
  count: number;
  firstEventAt: number;
}

const sessionMap = new Map<string, SessionEntry>();
const sessionOrder: string[] = [];

/**
 * Check if a session is sending events at inhuman velocity.
 * Returns true if suspected bot (>6 events within 3 seconds).
 *
 * In-memory and ephemeral — acceptable for serverless since the bot
 * fires bursts of events within 2 seconds of a single invocation.
 */
export function checkSessionVelocity(sessionId: string): boolean {
  const now = Date.now();
  const entry = sessionMap.get(sessionId);

  if (entry) {
    const elapsed = now - entry.firstEventAt;
    if (elapsed > VELOCITY_WINDOW_MS) {
      // Window expired, reset
      entry.count = 1;
      entry.firstEventAt = now;
      return false;
    }
    entry.count++;
    return entry.count > VELOCITY_THRESHOLD;
  }

  // LRU eviction
  if (sessionMap.size >= MAX_ENTRIES) {
    const oldest = sessionOrder.shift();
    if (oldest) sessionMap.delete(oldest);
  }

  sessionOrder.push(sessionId);
  sessionMap.set(sessionId, { count: 1, firstEventAt: now });
  return false;
}
