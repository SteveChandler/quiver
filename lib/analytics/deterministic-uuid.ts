import { createHash } from "node:crypto";

// Fixed namespace for Quiver analytics event uuids (RFC 4122 v5).
const QUIVER_ANALYTICS_NAMESPACE = "5f0c7a3e-8d3b-4b1e-9a57-2c4e6d8f1a90";

/**
 * Deterministic RFC 4122 v5 uuid. PostHog dedupes on an event's `uuid`, not on
 * `$insert_id`, so a retried capture of the same source row needs the same one.
 */
export function deterministicEventUuid(name: string): string {
  const hash = createHash("sha1")
    .update(Buffer.from(QUIVER_ANALYTICS_NAMESPACE.replace(/-/g, ""), "hex"))
    .update(name)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
