import type { SessionLogMetadata } from "@/types/implicit-preferences";

const SESSION_LOG_TELEMETRY_SCHEMA_VERSION = 1;

export function createSessionLogFlowId(): string {
  return crypto.randomUUID();
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
