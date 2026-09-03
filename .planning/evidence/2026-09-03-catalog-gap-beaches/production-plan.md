# Production plan — 28 catalog-gap beaches

Scope:28 new catalog beaches,28 Open-Meteo source mappings,12 verified provider camera URLs and5 licensed Wikimedia photo rows. No changes to existing beach records. No terrain/empirical shoaling writes, SEO/recommendation promotion, native release, user-data mutation or unrelated pending migration.

1. Commit the reviewed task-owned migration, camera classifier/tests, catalog-gap documentation and evidence to main, excluding unrelated worktree changes. Publish the classifier through the existing web release flow and verify the deployed revision before data application. Prior Hawaii10 and seven-existing-beach-camera migrations are separate pending batches and are not authorized by this plan.
2. Target:production owner connection POSTGRES_URL_NON_POOLING in .env.production.local; role postgres. Use established migration tracking. Never print credentials.
3. Backup:/tmp/quiver-catalog-gap-beaches-20260903.dump; created 2026-09-03T19:26:25.402Z; 634898 bytes; SHA256 40bf43fe483d0851d59fcbb2875db5de25fb8d7ba9f760b94ac36631a8b6c458. PostgreSQL15 custom archive of public.beaches, public.beach_sources and public.beach_photos; pg_restore --list passed. Refresh if older than24 hours.
4. Recheck exact28 UUID/name/slug/coordinate identities, active/alias/nearby conflicts and version20260903200000 ledger status. Recheck volatile12 camera links. Stop on a conflict or unavailable selected provider; any SQL change requires a new plan approval.
5. Apply only supabase/migrations/20260903200000_add_verified_catalog_gap_beaches.sql, SHA256 0c4d4eb8ca0b1a0fa27f5034905edfd5641a3a9c8e74932cd0bbe2864a80a83b, with stop-on-error. Do not apply unrelated pending migrations. Record the exact successful SQL in supabase_migrations.schema_migrations using the production owner; tracking is gated on successful commit.
6. Postflight every proposed UUID against proposed.json:28 beaches,28 sources,12 exact camera values,5 exact photo tuples and full source/license attribution. Confirm existing rows unchanged. Verify public web search/detail and provider click-outs after cache expiration. Native catalog behavior must be checked separately before claiming on-device visual success.
7. Forecast-source metadata is prepared, but forecast generation/runtime and scoring inputs remain incomplete. Keep recommendation_eligible=false, seo_indexable=false, terrain_enabled=false and shoaling_factors=null for this initial catalog batch.
8. On failure determine transaction/ledger state before retry. Do not delete newly added beaches after dependent user data may exist. A rollback/repair needs an exact separately reviewed plan restoring only affected rows from the backup, never a whole-table overwrite.

## Exact reviewed file hashes

- lib/media/cam-embed.ts: d27cd6db50adba4ff18b1ee2c967909fbc80b7d03c5ff3790e887155c7a1b8ff
- __tests__/lib/media/cam-embed.test.ts: 442925bd791699fade71a33b6f0132c253fd945cb384ef3690022518e3e233ab
- __tests__/components/beach-detail/cams-section.test.tsx: 73db66398fbb007dce35d4eb73020a6aa1fd79f0efbb8f86f0686d2ff73de8e3
- supabase/migrations/20260903200000_add_verified_catalog_gap_beaches.sql: 0c4d4eb8ca0b1a0fa27f5034905edfd5641a3a9c8e74932cd0bbe2864a80a83b

## Exact target rows

- ab8127ed-3653-505b-968f-b0a5bbf074a4 — Kamakahonu Beach (HI), 19.63934, -155.99748
- 58a2b3e5-6a3a-541c-8d4d-afacfd26dab1 — Turtle Bay West (HI), 21.705403, -158.00333
- 6270f847-045d-5be4-b8ab-e98d7fdfdd5e — Lawai Beach (HI), 21.8812, -159.4763
- 75e0bd7d-f25d-54eb-b455-af99eb561200 — Kaanapali Beach (HI), 20.922221, -156.6963
- d640e904-4a17-597a-98e7-11c42e9c8166 — Pohaku Park (S-Turns) (HI), 20.96708, -156.68165
- 313e745b-4521-57d4-9d33-808acaca4761 — Kaunaoa Beach (HI), 20.0045643, -155.8253
- 0922be9c-e437-5f0a-90a8-82588f429564 — Napili Bay Beach (HI), 20.99554, -156.667
- 67def85b-7500-5ccb-bd86-7141652da53e — Kamaole Beach Park II (HI), 20.7164722, -156.4473
- 52a9f0a9-7252-55c7-837d-8843e60bd43f — Wailea Beach (HI), 20.6829994, -156.44365
- ac6d886e-7326-5710-91e7-0bc3c7f21e70 — Kihei Cove (HI), 20.727759, -156.450398
- 090f4927-d319-53fb-990c-9c6bca55289b — Sharp Park Beach (CA), 37.6324357, -122.494697
- 41637008-fad6-53f2-92ac-3377df9aec36 — Santa Cruz Main Beach (CA), 36.962058, -122.02219
- ae84ce3a-25ed-5600-804c-cd1d8aa5ca00 — Roads End Beach (OR), 45.00827, -124.0105
- f73cea3d-d7c7-57cf-b2d1-9a4370f75123 — Muir Beach (CA), 37.8594, -122.57728
- 90df1267-5d2e-51b6-ba06-21e89405166c — Cowell Beach (CA), 36.960806, -122.0243
- 0a76eb21-c49a-562a-ad1a-19240b44b543 — Dillon Beach (CA), 38.249, -122.9698
- a7a94616-4d60-5965-b1be-568890d162e8 — North Salmon Creek Beach (CA), 38.3573, -123.0681
- 5f857910-8ba3-555a-992d-7180018ea486 — Kalaloch Beach (WA), 47.605564, -124.378775
- 34e148b8-08cc-50cb-908f-012464b7fa74 — Virginia Beach Oceanfront (VA), 36.853333, -75.973056
- c5cb000f-c684-5fa6-8e71-52ca2ff71cfe — Jenkinson’s Beach (NJ), 40.09355, -74.03434
- 008db74c-cddf-50c7-802d-80f039ad0868 — TOBAY Beach (NY), 40.6078, -73.4333
- b1831be4-6333-5c39-9d69-6624d40c2175 — Atlantic City Beach (NJ), 39.35813, -74.4178
- fea81a34-3a55-5a3c-9656-1de099818e07 — Main Beach (East Hampton) (NY), 40.9424, -72.1944
- c018c79c-ece5-5140-9d2c-50a664c6d493 — Rehoboth Beach (DE), 38.7202, -75.0756
- f950d05c-2a78-5bcd-8d5f-01fcc7c51633 — St. Augustine Beach Pier (FL), 29.8576, -81.264
- 0bc849fa-7e06-5600-8176-d2fda5ecfbf0 — Ocean City Beach (Maryland) (MD), 38.370114, -75.067683
- fa504123-92e2-59fd-a0b5-0c4a85cca27a — East Beach (St. Simons Island) (GA), 31.1439, -81.3688
- 91a6c7f9-ae5d-5a26-89b1-fd7587e1fee4 — Cherie Down Park Beach (FL), 28.39179, -80.59513
