# Exact owner-write approval

Target: Supabase project vawdnbbgawichorsjiwe, production owner role postgres, table public.swell_watch_evaluation_policies only.

Install file: docs/operations/swell-watch-v2-policy-install.sql
SHA-256: 38bcd6b2fe7de8cb2d8fb4104fa0fad06bca863cbe5b52d89c3e1a3e898c905e

Rollback file: docs/operations/swell-watch-v2-policy-rollback.sql
SHA-256: 0f6c3739ba60cc07f1b1bb3643036db2e44ffa039c6b08b1dda779fb6ae6df68

Effect: append exact guarded epoch2 evaluation-only v2 policy; preserve expiry 2026-10-25T02:45:47.591003Z. Rollback appends epoch3 restoration of v1; no deletion or renewal. No schema migration or production push authority is created.

Before execution: create and validate a fresh focused pg_dump archive at /Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-current/backups/swell-watch-v2-20260910/swell-tables.dump; stop if archive fails. Recheck exact ledger and hashes, verify reviewed deployed source/configuration, disable shadow evaluation during transition, keep both send flags false and durable send control disabled. Unexpected state aborts, not an implicit permission to rewrite SQL. Record execution receipt and backup digest. Restore shadow evaluation only after exact policy/config agreement; sends stay disabled.

Sol review and disposable PostgreSQL tests passed for these exact SQL artifacts. No owner write has yet been executed.
