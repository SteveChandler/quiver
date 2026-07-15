# Android Beta Legacy Offer Runbook

## Purpose

The public promise to grant one year of Quiver Pro after Android closed-test participation is retired for new testers. People who enrolled while that promise was visible remain eligible for fulfillment. This runbook defines the evidence boundary without committing tester identities to git.

## Cutoff

The authoritative cutoff is the completion timestamp of the production Vercel deployment containing the incentive-removal commit. Record both values here during the approval-gated deployment:

- Removal commit: `PENDING_INCENTIVE_REMOVAL_COMMIT`
- Production deployment: `PENDING_VERCEL_DEPLOYMENT_URL`
- Cutoff UTC: `PENDING_PRODUCTION_DEPLOYMENT_COMPLETION`

Do not substitute the local commit time. The old promise remains public until the production deployment completes, so a local or push timestamp could exclude someone who still saw it.

## Pre-change evidence audit

A read-only production audit at `2026-07-15T14:06:00.132Z` found:

- `android_beta_leads`: 0 rows.
- `profiles.wants_android_access = true`: 1 row, with `android_waitlist_joined_at = 2026-06-13T22:46:55.448Z`.
- Google Group membership: not publicly enumerable; an owner/manager export is required at cutover.

These counts intentionally omit emails and user IDs. Tester identities belong in the private fulfillment ledger, never this repository.

## Cutover evidence capture

Immediately before deploying the removal commit:

1. Export the Quiver Android testers Google Group member list from the owner/manager console. Preserve the export timestamp and join timestamps when Google supplies them. If join timestamps are unavailable, treat every member present in the pre-deploy snapshot as pre-cutoff.
2. Deploy the removal commit to production.
3. Record the successful deployment completion timestamp above as `cutoff_at`.
4. Run the database evidence query below using that timestamp.
5. Store the Group export and query result in the approved private operations vault. Record only aggregate counts and artifact checksums in git.

```sql
with eligible_leads as (
  select lower(email) as email, created_at as enrolled_at, 'lead' as evidence_source
  from public.android_beta_leads
  where created_at <= :cutoff_at
),
eligible_profiles as (
  select lower(email) as email,
         android_waitlist_joined_at as enrolled_at,
         'profile_flag' as evidence_source
  from public.profiles
  where wants_android_access = true
    and email is not null
    and android_waitlist_joined_at <= :cutoff_at
)
select email, min(enrolled_at) as enrolled_at,
       array_agg(distinct evidence_source order by evidence_source) as evidence_sources
from (
  select * from eligible_leads
  union all
  select * from eligible_profiles
) evidence
group by email
order by enrolled_at;
```

Merge the query output with the Google Group export by normalized lowercase email. A tester is grandfathered when at least one lead, profile-flag, or Group-membership record is at or before the cutoff.

## Fulfillment

1. Verify the grandfathered tester completed 14 days in the closed test. Do not require product actions that were not part of the original promise.
2. Resolve the tester email to the Quiver/RevenueCat app user ID. Contact unmatched testers rather than guessing an account.
3. Grant the `Quiver Pro` RevenueCat promotional entitlement for 365 days. This is a production billing mutation and requires explicit approval. The weekly Earn-Pro helper grants only seven days and must not be used for this offer.
4. Insert an audit record in `earned_pro_grants` with reason `android_beta_legacy_free_year`, the exact expiration, and evidence-source metadata in `streak_snapshot`. Despite the historical column name, that JSON field is the existing grant evidence payload.
5. Record fulfillment date, RevenueCat response identifier, expiration, and operator in the private ledger. Keep only aggregate fulfilled/pending counts in repository documentation.

## Release gate

Do not close the GitHub issue until the production deployment URL, cutoff timestamp, pre-cutover Google Group export, database evidence export, and aggregate eligible count are recorded. No entitlement is granted as part of the code change.
