# Production plan: Redondo Beach jetty breaks (2 catalog rows)

Scope: insert 2 new `public.beaches` rows, Sapphire Street (Redondo Beach)
`c9ea72a3-d7bf-5f3d-b77e-1aa6cce81dee` and Knob Hill (Redondo Beach)
`50b0ec6c-9254-5450-9b23-90cb85997cb1`, plus 2 `public.beach_sources` rows
(`open_meteo`). Nothing else changes: no existing rows are modified, no schema changes, no
other pending migrations, no photos, cameras or terrain, and no user data.

1. Source: `supabase/migrations/20260914160000_add_sapphire_street_redondo_beach.sql` as merged to
   main through SteveChandler/quiver#779. SHA256
   `a483c27bfe17014f0e7e948935d33e0c9c4535228c46268fb2c55bb9c039dfd8`. Stop if the file on main
   differs.
2. Target: the production owner connection `POSTGRES_URL_NON_POOLING` from `.env.production.local`,
   role `postgres`, server 15.8. Use psql 15.14 and never print credentials.
3. Backup: `quiver-redondo-jetty-20260914.dump` in the session scratchpad, created
   2026-09-14T16:36:31Z, 522283 bytes, SHA256
   `8cac5c2cbb6ef54a68652e1a6063b3230c4e0882ce992f2296dbd4ba54439659`. It is a pg_dump 15.14 custom
   archive of `public.beaches` and `public.beach_sources`, and `pg_restore --list` shows both
   TABLE DATA entries. Refresh it if it is older than 24 hours at apply time.
4. Preflight, as of 2026-09-14T16:36Z, re-run immediately before apply. Stop on any difference:
   - 495 beaches and 172 beach_sources
   - pre-existing row hashes: `beaches_md5=9b73e6a989068d539c4aceffc4e6f2c9`,
     `sources_md5=6faf46597c96d26f3da18bd18d114a7f`
   - ledger has no `20260914160000`
   - neither UUID present, no name/slug conflict, no sapphire/topaz/knob names (deleted rows
     included), and no live beach within 1 km of either pin
   - all 14 required columns present
5. Apply: run the exact file with `psql -v ON_ERROR_STOP=1`. The file carries its own
   BEGIN/COMMIT and its own conflict and postflight guards. Only after it commits, insert the
   tracking row `(version '20260914160000', name 'add_sapphire_street_redondo_beach',
   statements ARRAY[<exact file text>])` into `supabase_migrations.schema_migrations` with
   `ON CONFLICT (version) DO NOTHING`.
6. Postflight:
   - both rows match name/slug/city/lat/lon/timezone exactly
   - `seo_indexable`, `recommendation_eligible`, `terrain_enabled` and `is_private` are all false
   - editorial_sources lengths are 7 and 5
   - 2 `open_meteo` sources exist
   - totals are 497 beaches and 174 sources
   - md5 over all rows excluding the 2 new IDs equals the preflight hashes, so existing rows are
     unchanged
   - ledger row present
   - public web search finds "sapphire", "knob hill" and "redondo beach"
7. On failure: the file's transaction rolls back as a whole. Determine transaction and ledger state
   before any retry. Do not delete rows once dependent user data may exist; any repair needs a new
   reviewed plan restoring only the affected rows from the backup.
