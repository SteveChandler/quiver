# No-send provider-run qualification — September 9, 2026

Decision: accept revision set `e7c5bc11-61a9-4299-9ceb-a6a8315b6741` as a genuine request-bound provider run for internal no-send evaluation, retaining explicit missingness. This is not forecast-accuracy validation, release approval, commercial-display entitlement, or a qualifying day of full cohort coverage.

User explicitly requested qualification of collected runs. Independent Sol technical review confirms the provenance chain is sufficient for this evaluation-only scope; it does not require paid access for prototyping. Reviewer identity for the owner decision is `Codex with independent Sol technical review; user-directed no-send evaluation`.

## Provider contract and execution chain

- [Open-Meteo Single Runs documentation](https://open-meteo.com/en/docs/single-runs-api), read September 9: the run parameter retrieves an individual model forecast by initialization time. The stored canonical request binds the run/model/location; a response need not repeat the initialization metadata to satisfy this documented request contract.
- [Open-Meteo pricing](https://open-meteo.com/en/pricing), read September 9: "Use the free tier for evaluation and prototyping." This decision applies only to internal no-send evaluation. Production display/send licensing is a separate release question.
- Acquisition deployment `dpl_2MU1JzRPBq7zSGdW6wM2qhDWTuPK` was built from clean production commit `6b076071d41665c77c0ef197a8668e61be68c864`. Its pinned, sequential fetch/parser and atomic receipt writer were independently reviewed against the frozen package.
- Authenticated acquisition returned HTTP 200 at `2026-09-10T02:51:05.721Z`, issuance `2963872a-76f7-453b-a96d-e4c3ad82837b`, run batch `dd28a1f3-119c-4349-a723-c871d8475d59`, and the exact revision set above; prototype_unqualified and zero enqueues. This receipt precedes the present reviewed qualification decision.
- Production SQL independently confirmed initialization `2026-09-09T18:00:00Z`, ten configured scopes, 3,360 expected and retained component slots, and all forecast timestamps within the seven-day run window. Ten retained raw responses pass their SHA-256 checks. The writer validates exact requests, model, coordinates, selected grid, units, ordered slots, and constituent values before storage.
- All ten configured source-point IDs match the retained scope inventory. Explicit missing components: Outer Banks source `d264fbf8-0525-4d31-adb5-9a0742eaeb7e`: 24; Rincon source `f11ccd59-b778-4ea1-a8ff-88bffb447cd8`: 1; remaining eight scopes: zero. Do not reinterpret these as zero-height usable swells or silently remove these scopes.

## Authority boundary

Record only an accepted owner attestation bound to this document's SHA-256 and the exact latest revision set, then call the existing completion RPC. Both actions preserve SQL supersession/revocation checks. The reviewer is accurately identified as the technical agent review, not an invented human review. The user directs this no-send qualification.

No push authority, enqueue, delivery, or automatic future-run attestation is authorized by this document. New runs need their own reviewed provenance and coverage; duplicates are not independent temporal confirmation. Keep both send flags false. Evaluation may run after the reviewed policy calculation fix is deployed, but the existing whole-cohort missing-partition suppression remains intact.

Rollback is append-only revocation of this exact attestation, not deletion or restoration over production data. The existing current Swell Watch table backup predates acquisition; retain raw receipts and any later observations. No schema change is required.
