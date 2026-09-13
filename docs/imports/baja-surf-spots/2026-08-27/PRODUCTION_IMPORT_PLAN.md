# Baja surf spots production import plan

## Exact artifact

- Migration: `supabase/migrations/20260827190000_import_baja_surf_spots.sql`
- Migration SHA-256: `8d2679750b561ac304e9d2f36cf6bc8b20dc648cec3863784eeb895001b92a0a`
- Dataset: `baja-surf-spots-production-enrichment-v2-2026-08-27`
- Dataset SHA-256: `46a482040fcff865a7b7c7ec3994c762c4ec9c975fcbd013bb56ede3947e4957`
- Enrichment script SHA-256: `b7f851a68549a785e0edaaba787e2e36221730fd7ef19e50e17678c5a9847dfc`
- Migration generator SHA-256: `aa49788cb5844fe0850aaea49885d5bdf2c8330ffb086afbc2cc8f26e739d29a`
- Swell land-configuration audit SHA-256: `55066668a2cac0b0ae405ea6683fc6ae2857304c64fb4a167aed7ecca03f5148`
- Swell bathymetry audit SHA-256: `042c8c02da0d18a35a309dda48cfa23f0eeacb26e5faf98b9f41bc5cbba5b5a6`
- Bathymetry research script SHA-256: `dc3dbfb1a3e3ae2f84945a9941127349c076c61f18ea4abcc6868645e5b09884`
- Production release merge: `8b721ea4a4da09acf34cdfcc0ebc9d9024b9dde0`
- Execution checkout: `codex/prod-forecast-provenance-20260828`, based at local commit `569b028bb`, plus the seven exact corrected artifacts hashed above.
- Execution checkout contents: the deployed `prod` tree plus the two canonical, already-remote-tracked Seaside migration files from `c9a45d3f1`; the reconciliation commit is local only and must not be pushed as part of this database operation.
- Before apply, commit exactly the corrected dataset, enrichment script, migration generator, land-configuration audit, bathymetry audit, bathymetry research script, and regenerated migration locally with subject `fix(data): validate Baja swell windows`. Do not stage this plan file or push the execution branch. Creating that content-preserving local commit does not invalidate this plan; any artifact-content change does.

## Target and execution

- Target: Quiver production Supabase project `vawdnbbgawichorsjiwe`.
- Connection: production owner connection obtained at runtime through the authenticated Supabase CLI path.
- Execution directory: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/prod-forecast-provenance`.
- Apply mechanism: `supabase db push --db-url <runtime-derived-production-owner-url>` from the execution checkout. The database credential must not be printed, copied into this plan, or placed in shell history.
- Expected pending set: exactly `20260827190000_import_baja_surf_spots.sql`; stop if the CLI selects any other migration.
- No service-role application write and no untracked SQL-editor execution.

## Final preflight evidence

Completed on 2026-08-28 between 18:27 and 18:50 PDT:

1. All four deployed `/images/beaches/baja/*.webp` assets returned HTTP 200.
2. Fresh PostgreSQL 15 custom archive: `/tmp/quiver-prod-pre-baja-import-2026-08-28T1828.dump`.
3. Backup size: 228,824,975 bytes.
4. Backup SHA-256: `e571e1a22fb4ea7fae95516294af8447a8ee0c73a8e68bc49313a5df1316a23a`.
5. `pg_restore --list` successfully read the backup catalog.
6. Production tracks Seaside migrations `20260827170000` and `20260827171000`; their canonical local files have SHA-256 values `cf08823f09c4dec61c3ffbf91cfd5e7893dc0ab6839ef08a20a8a0a4d370f2d8` and `e76d78071fe172ce54aaedbf34addf8d36868a0ad8418c4ce5df32d82d35337e`.
7. After local migration-history reconciliation, `supabase db push --dry-run` selected only `20260827190000_import_baja_surf_spots.sql`.
8. Read-only data preflight found 112 eligible staged spots: 105 inserts and seven UUID-preserving updates.
9. All seven update UUIDs exist in production; zero are missing.
10. Zero staged lower-cased beach names belong to a different production UUID.
11. SQL safety scan found no persistent `DELETE`, `TRUNCATE`, or `DROP`; the only `DROP` clauses are `ON COMMIT DROP` for transaction-local temporary staging tables.
12. The first approved apply attempt was rejected atomically before commit because Baja Malibu used the source-equivalent boundary `360°`, while the live constraint requires `[0, 360)`. Post-failure verification found migration tracking count zero, both migration-created backup tables absent, and only the original seven target beach rows present.
13. The pipeline-level boundary correction normalizes `360°` to its circularly equivalent `0°`. The subsequent multi-source review superseded Baja Malibu's provisional `270°–0°` range with `202.5°–315°`, so the staged row no longer uses the north boundary.
14. The enrichment pipeline now normalizes degree boundaries into `[0, 360)`, and both enrichment validation and migration generation reject out-of-range values.
15. Regeneration produced 112 rows, and all 112 passed the live `beaches` check-constraint equivalents.
16. Satellite review resolved the five selected-vs-soft-prior conflicts: Baja Malibu `202.5°–315°`, Marisol North Point `270°–315°`, La Mision `225°–315°`, Punta Santo Domingo `157.5°–225°`, and Monuments `202.5°–270°`.
17. The 67 low-confidence fallback windows were cross-referenced against satellite land configuration. Two source errors were corrected with independent evidence: Salsipuedes to `270°–315°` and Playa San Pedro to `180°–247.5°`.
18. All 112 rankable Baja windows were audited against a 500 m GMRT subset and the independent NOAA ETOPO 2022 15 arc-second grid. One hundred eleven pass the direct dual-grid threshold. Punta Arenas is the sole allowlisted refraction exception: two exact guides publish south swell, SurfTrips documents the Gulf wrap, two sampled SSE bearings remain open in each grid, and the window was narrowed from `157.5°–202.5°` to `157.5°–180°` to remove the land-blocked SSW side. All 112 now have medium-confidence reviews; no staged swell window remains low confidence or awaits session calibration.
19. The exact downloaded grid inputs are not committed. Their reproducible request URLs and SHA-256 values are recorded in the bathymetry audit: GMRT `743bfbd029400b02e3b23c2ed0c29dca2c7d5286dd4f919038f133131bc34eb6`; ETOPO `6b45efebc8c8a565c74d18b0aa1d75ea5833cfbaf71c2341c00a0142508867c2`.
20. The post-bathymetry linked dry run has not yet been repeated. A read-only attempt from the isolated worktree stopped with `LegacyProjectNotLinkedError` before connecting. Re-link through the authenticated production-owner path and require the pending set to be exactly `20260827190000_import_baja_surf_spots.sql` before requesting approval.

Any change to the seven hashed artifacts, target, backup artifact, pending migration set, or preflight results invalidates approval and requires a new plan hash.

## Mutations

- `public.beaches`: insert 105 rows and update seven rows while preserving their UUIDs.
- `public.beach_photos`: insert or update 112 approved hero-photo rows.
- `public._backup_baja_beaches_20260827`: first-capture backup of the seven updated beach rows.
- `public._backup_baja_beach_photos_20260827`: first-capture backup of any genuinely replaced photo rows.
- `supabase_migrations.schema_migrations`: normal CLI tracking entry for version `20260827190000`.

The transaction imports only the 112 rankable surf spots. It excludes the two parent-area metadata records, keeps all imported beaches public and active, preserves Baja timezones, and forces `seo_indexable = false`. Recommendation readiness does not waive the separate review contract in [`docs/seo/BEACH_INDEXING_ELIGIBILITY.md`](../../../seo/BEACH_INDEXING_ELIGIBILITY.md).

## Post-apply verification

Immediately after the tracked migration succeeds, perform read-only checks confirming:

- 112 active target beach UUIDs exist.
- 112 matching approved, non-deleted hero photos exist.
- 67 target beaches use `America/Tijuana` and 45 use `America/Mazatlan`.
- Zero target beaches have `seo_indexable = true`.
- Seven beach backup rows exist.
- The migration tracking row exists exactly once.
- Native/public reads can retrieve the imported rows and finite coordinates.

Stop and restore from the fresh dump if any invariant fails. Do not delete inserted beaches after user, session, forecast, or other dependent data begins referencing them; any later rollback requires a separately reviewed dependency-aware plan.
