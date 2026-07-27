export interface RosterAuditClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
}

export async function recordMandatoryRosterAudit(
  client: RosterAuditClient,
  {
    actorUserId,
    entryId = null,
    action,
    evidence = {},
  }: {
    actorUserId: string;
    entryId?: string | null;
    action:
      | "read_summary"
      | "reveal_identity"
      | "export_non_pii"
      | "sync"
      | "record_play_evidence";
    evidence?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { error } = await client.rpc("record_android_tester_roster_audit", {
    p_actor_user_id: actorUserId,
    p_entry_id: entryId,
    p_action: action,
    p_outcome: "attempted",
    p_evidence: evidence,
  });
  return !error;
}
