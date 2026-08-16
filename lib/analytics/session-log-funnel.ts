import type { SessionLogMetadata } from "@/types/implicit-preferences";

export const SESSION_LOG_TELEMETRY_SCHEMA_VERSION = 1;

export function createSessionLogFlowId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function buildSessionLogEventMetadata(
  flowId: string,
  metadata: SessionLogMetadata = {},
): SessionLogMetadata {
  return {
    schema_version: SESSION_LOG_TELEMETRY_SCHEMA_VERSION,
    flow_id: flowId,
    client_stage_at: new Date().toISOString(),
    ...metadata,
  };
}
