# Exact 06Z owner-attestation and completion approval

Status: proposed; not executed. This is the only approval artifact for the fresh 2026-09-10 06Z run. The earlier `APPROVE: adcd…` token authorized the evaluation-policy epoch-2 transition only; it does not authorize this attestation or completion.

## Exact owner action

Target: Supabase project `vawdnbbgawichorsjiwe`, production owner role `postgres`.

Artifact: `docs/operations/swell-watch-20260910-06z-owner-attestation-completion.sql`

SHA-256: `6daed7c8533961d6a13ffcdefa7c0f34bab03f90d266048458ef626d9205d17a`

Execution requires a new user message exactly `APPROVE: <SHA-256 of this approval file>`. The named owner reviewer recorded by the SQL is `Steven Chandler (owner approval recorded by exact plan token)`. Do not execute without that new token; do not substitute an assistant, technical-review, prior-run, or policy-ledger approval as the owner.

The SQL calls only the existing owner-only `attest_swell_watch_provider_run` decision RPC and existing `complete_swell_watch_provider_run_receipt` RPC. It does not install policy, rewrite receipts, create evaluations, enqueue notifications, grant push authority, or send.

## Immutable subject and evidence

- Issuance `58713376-6e62-4c12-8a1a-170e0b30026e`; run `2026-09-10T06:00:00Z`.
- Batch `c89b1ec0-6ab0-461e-97b8-e3495696e573`; scope hash `2a07d88c0b1d4ab9c04fc8bcdc72f8363a3d850c3d622a55e155374ec0428242`; 3,360 retained components.
- Only/latest revision set `ac1bf4d5-0fd9-40a0-b16c-090a19794ed5`, revision 1, revision-set hash `4cebbb10597677f18b3d17945fcdaa89ee722af3e64df0128a0da33823a8e554`.
- Fixed attestation ID `5425696b-1363-4e9c-be1a-67829c89b141`.
- Evidence SHA-256 `62af9c7086ea09e83f3ec5c0313c716024f8376c173255510cb7e6210a416f4d` is the digest of the canonical UTF-8 JSON manifest embedded verbatim as `v_manifest_text` in the SQL. The SQL independently recomputes that digest before any write, then compares every manifest source point to its retained raw-response and semantic-revision hashes.
- The same guards require ten scopes of 336 components, exactly 27 retained `provider_zero_tuple` components at Outer Banks source `d264fbf8-0525-4d31-adb5-9a0742eaeb7e`, all at S2, and no unavailable component elsewhere. These remain unavailable evidence, not usable zero-height swells.

## Preconditions and stop conditions

Before owner execution, recheck all of the following read-only. Any mismatch, additional/partial attestation or completion, expired freshness, changed policy/deployment/configuration, notification evidence, or failed backup stops the operation; do not edit this SQL to accommodate drift.

1. The v2 deployment is the reviewed production source/configuration: commit `8ae100a52107a7ce7f489104b005664c1b63b0a3`, proposed v2 configuration SHA-256 `6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403`, and policy hash `86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f`. Recheck actual deployment/runtime configuration; configuration metadata alone is insufficient.
2. Epoch 2 is the current active evaluation ledger policy with that v2 policy hash and configuration evidence hash. Its expiry is still future. Durable automation control is exactly `disabled`; no production push authority exists; `SWELL_WATCH_ENABLED` and `SWELL_WATCH_PUSH_ENABLED` remain false.
3. The focused owner backup exists and its SHA-256 still equals `d21ea4d8c005b2968761f889734113b4db1914d28eba2312736b31978dd9b9f1`: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-current/backups/swell-watch-v2-20260910/swell-tables.dump`.
4. The complete immutable subject, all ten source/raw/semantic hash mappings, component counts, and retained missingness still match the SQL manifest. The run must be less than or equal to 12 hours old at execution; this plan therefore expires at `2026-09-10T18:00:00Z`.
5. No attestation or completed-batch row exists for this revision set before the first execution. An exact successful rerun is allowed only when the one exact accepted attestation and one exact completion already exist; all conflicting or partial state is rejected.

## Expected receipt and boundaries

The successful completion RPC returns a newly allocated completed provider-batch ID and exactly `genuine_completed:c89b1ec0-6ab0-461e-97b8-e3495696e573`. Record that returned ID and post-write proof of the immutable attestation fields, coverage/missingness, v2 ledger identity, disabled control, absent push authority, and zero Swell Watch notification/announcement bindings.

This authorizes no future-run attestation, cohort reduction, missingness normalization, qualifying-day claim, send, announcement, delivery, or production-policy change. It does not establish a complete cohort or a successful evaluation. If a later no-send evaluation suppresses because of missingness or physical policy, record that outcome without relabeling it as a qualifying day.
