# The migration chain cannot rebuild the database from scratch

**Date:** 2026-08-13
**Status:** Diagnosed, not fixed. Blocks local Supabase replay; blocks rebuilding production from migrations.
**Severity:** Production is healthy and unaffected. This is a disaster-recovery and developer-environment defect.
**Found by:** attempting `supabase start` to verify the UGC video storage round trip.

---

## 1. Symptom

`supabase start` / `supabase db reset` fails partway through the 728-migration replay:

```
Applying migration 20260808052000_correct_san_diego_beach_coordinates.sql...
ERROR: Expected to correct 3 San Diego beaches, corrected 0; catalog identities changed
```

All containers are torn down, so there is no usable local environment.

**`20260808052000` is the canary, not the culprit.** It is the only migration in its class that verifies its own effect. Patching it would silence the alarm and leave the underlying defect in place — see §4.

---

## 2. Root cause

`beaches` rows are created by **two incompatible generations of migration**, and the older one does not control primary keys.

**Generation 1 — `20250808130000_seed_beaches.sql`** inserts from a JSON list of `(name, region, country, lat, lon)`:

```sql
INSERT INTO public.beaches (name, region, country, lat, lon)
SELECT tb.name, tb.region, tb.country, tb.lat, tb.lon
FROM temp_beaches tb
WHERE NOT EXISTS (
  SELECT 1 FROM public.beaches b WHERE lower(b.name) = lower(tb.name)
);
```

No `id` column. **Every fresh replay generates new random UUIDs** for these rows. Production's UUIDs exist only in production.

**Generation 2 — 18 later migrations** insert with an explicit `id` (`20251205000000_add_socal_beaches.sql`, `20251207000000_add_east_coast_beaches.sql`, `20260522162000_expand_socal_sandy_beginner_coverage.sql`, and 15 others). These are replay-stable.

**The two generations collide, and generation 1 wins.** `beaches` carries `CREATE UNIQUE INDEX beaches_name_unique ON public.beaches (lower(name))`, while the generation-2 inserts use `ON CONFLICT (slug) DO UPDATE` / `DO NOTHING`. A conflicting insert therefore updates the existing row — and **Postgres never rewrites the conflict-target row's primary key**. Once the name-only seed has created a beach with a random UUID, every later migration's explicit `id` for that beach is silently discarded.

---

## 3. Blast radius

**24 migrations target beaches by hardcoded production UUID, referencing 344 distinct UUIDs** — effectively the entire 346-row catalog.

| migration | hardcoded UUIDs |
|---|---|
| `20260628004500_stage_geometric_swell_windows_v2` | 321 |
| `20260211120000_comprehensive_swell_window_fix` | 251 |
| `20260407134519_add_shoaling_factors_to_beaches` | 99 |
| `20251025200000_populate_surf_spot_data` | 44 |
| `20260211060000_fix_hi_pr_beach_slugs` | 32 |
| `20260408131812_calibrate_station_111_beaches_via_cdip_215` | 18 |
| `20260712230000_complete_oahu_beach_catalog` | 18 |
| …17 more | ≤8 each |

On a fresh replay, every one of these that targets a generation-1 beach matches **zero rows**. Almost all are bare `UPDATE`s with no assertion, so they **silently no-op** and the replay continues.

A database rebuilt from migrations would therefore be missing, without any error:

- per-spot surf data (`populate_surf_spot_data`)
- shoaling factors
- swell-window corrections
- slug fixes for HI/PR
- CDIP station calibration
- the San Diego coordinate corrections

**This is the same class of failure as the alert-flag outage and the community-photo pipeline: a mechanism reporting success while delivering nothing.**

### Why the failure surfaces where it does

- `20260628004500` (321 UUIDs) is written to be replay-tolerant — it stages only `matching_candidate` rows that actually exist and asserts merely `expected_count > 0`. Enough generation-2 beaches match, so it passes.
- `20260808052000` asserts an exact count (`IF updated_count <> 3 THEN RAISE`). Its three targets — **La Jolla Shores**, **Tourmaline Beach**, **Birdrock** — are all La Jolla/PB spots. Birdrock exists *only* in the generation-1 name-only seed. La Jolla Shores and Tourmaline appear in generation-2 `20260522162000`, but the seed creates them first and `ON CONFLICT (slug)` cannot repair their ids. All three end up with random UUIDs, `updated_count = 0`, and the migration correctly refuses.

---

## 4. Production is not affected

Verified live against production on 2026-08-13:

| UUID | name | coords applied |
|---|---|---|
| `d291411d-…c69de0` | La Jolla Shores | yes |
| `17628f35-…4bd73bb8` | Tourmaline Beach | yes |
| `ca2b1d6f-…eeec4323` | Birdrock | yes |

346 beaches total, all three rows present with matching names and the corrected coordinates. Production accumulated the correct UUIDs historically and every migration applied against them successfully. **Nothing needs fixing in production data.**

---

## 5. Options

**A. Do not "fix" `20260808052000` in isolation.** Relaxing its assertion is a one-line change that makes the replay proceed, but it removes the only signal that the catalog is wrong and leaves the six silent data gaps in §3. If the goal is a *working local environment*, this is a trap; if the goal is a *faithful* one, it does nothing.

**B. Pin the generation-1 ids. DONE, VALIDATED — AND NOT SUFFICIENT.** `20250808130000_seed_beaches.sql` now carries explicit production UUIDs for 70 of its 72 entries (see §7). Validated on a scratch PostgreSQL 15.14: a fresh run produces 72 rows with production's exact primary keys, a second run is idempotent, and against a database already holding a pinned id under a renamed row it neither errors nor overwrites. It is a genuine no-op where the rows exist, production included.

It does **not** unblock the replay, because of a larger defect found while validating it — see §5a.

**C. Ship a schema snapshot for local development.** Stop treating full replay as the local bootstrap; generate a periodic `schema.sql` + sanitised catalog dump and have `supabase db reset` load that. Fastest route to a working local environment, but leaves the replay path broken for disaster recovery.

**D. Add a replay CI gate.** Whatever is chosen, nothing currently detects this — GitHub Actions have been disabled since 2026-05-06, so no automated replay runs. Without a gate, the chain will drift again.

Recommended: **B** (done) is a prerequisite, but **§5a is the blocking defect**. **C** is now the only realistic route to a working local environment in the short term. **D** still applies regardless.

---

## 5a. The larger defect: a third of the catalog is not creatable at all

Found while validating option B. Cross-referencing every `INSERT INTO beaches` that supplies an explicit `id` (plus the newly pinned seed) against the live catalog:

| | |
|---|---|
| Beaches in production | 346 |
| Creatable by migrations | 239 |
| **Not creatable — exist only in production** | **107 (31%)** |

A third of the catalog is created by no migration in the repository. Examples: Tourmaline Beach, Huntington Beach Pier, Ocean Beach Pier, Hermosa Pier, Grandview Beach, Makaha, Laniakea, Bandon, Carmel Beach, Pawleys Island Pier.

**This is why the replay still fails after pinning.** `20260808052000` needs three rows; pinning fixes two:

| target | creatable after replay |
|---|---|
| La Jolla Shores | yes — pinned in the seed |
| Birdrock | yes — pinned in the seed |
| **Tourmaline Beach** | **no — no migration inserts it** |

Every reference to Tourmaline's id `17628f35-…` across six migrations is an `UPDATE … WHERE id`. Nothing creates it. The same holds for the other 106.

Combined with the manual renames already noted (`Blacks` → `Blacks Beach`, `Grandview` → `Grandview Beach`, `North HB Streets` → `Goldenwest`, none of which appear as `SET name` in any migration), the conclusion is that **the production catalog has been maintained substantially outside the migration chain.** The chain cannot reproduce it, and no amount of id-pinning changes that.

Fixing this properly means a catalog-restore migration that inserts the 107 orphaned rows with their production ids — worth doing for disaster recovery, but it is its own piece of work and should be generated from the live catalog rather than hand-written.

---

## 6. Immediate unblock for the UGC video work

The storage round trip needs `sessions`, `session_media`, and the storage service — not an accurate beach catalog. Any of:

- Option **C** (snapshot), which sidesteps the replay entirely; or
- a local-only relaxation of `20260808052000` that is **never committed**; or
- deferring the round trip and merging the UGC branch on unit-test evidence alone, accepting that storage-RLS path handling, signed-URL generation, and both moderation queues remain unproven end to end.

The last is not recommended: the `session-videos` storage policy keys on `(storage.foldername(name))[2] = auth.uid()`, which fails silently if the path layout is wrong, and silent failure is exactly what this codebase keeps getting caught by.

---

## Appendix — reproducing

Static analysis of `supabase/migrations/*.sql`; no database was queried for §2 and §3. §4 was verified against production with a read-only service-role query. The replay failure in §1 was observed by the operator running `supabase start` after supplying the `20260618160000` approval GUC.

Counts: 24 migrations matched `beaches` + hardcoded UUID + id-targeting predicate; 344 distinct UUIDs across them; 18 migrations insert `beaches` with an explicit `id` column.

---

## 7. What changed in `20250808130000_seed_beaches.sql`

- `temp_beaches` gains an `id uuid` column; the `jsonb_to_recordset` signature and staging insert carry it through.
- Each of the 72 JSON entries gains an `"id"`. **70 are pinned** to production UUIDs matched case-insensitively by name.
- **2 are deliberately left `null`** — `"Grandview"` and `"North HB Streets"`. Production renamed them outside of migrations (`Grandview Beach`, `Goldenwest`); no migration pairs an id with the seed's name, so the match would rest on coordinate proximity alone. They fall back to `gen_random_uuid()`, exactly as today. `"Blacks"` *is* pinned, because `20251208100000_fix_blacks_beach_data.sql` explicitly pairs `01330afc-…` with `name = 'Blacks'`.
- Both `INSERT` branches use `COALESCE(tb.id, gen_random_uuid())` and gain `ON CONFLICT (id) DO NOTHING`. The conflict guard matters: production holds the pinned `Blacks` id under the renamed row `Blacks Beach`, so without it a re-run would raise a primary-key violation instead of the silent duplicate it creates today.
- The `WHERE NOT EXISTS (lower(name))` guard is unchanged, so the insert remains name-idempotent.

### Validation performed

On a scratch PostgreSQL 15.14 instance (same major version as Supabase), not against local or production Supabase:

| check | result |
|---|---|
| Fresh database, single run | 72 rows |
| `La Jolla Shores` id | `d291411d-…c69de0` — exact match to production |
| `Birdrock` id | `ca2b1d6f-…eec4323` — exact match to production |
| Second run on the same database (idempotency) | still 72 rows |
| Run against a database already holding the pinned id under the renamed row `Blacks Beach` | no error; row count and existing name preserved |

Not yet validated: the full 728-migration Supabase replay, which remains blocked by §5a and, separately, by the human-approval GUC gate in `20260618160000_phase0_forecast_accuracy_metrics.sql`.
