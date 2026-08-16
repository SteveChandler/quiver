# ADR 002: Water-Quality Holds — Suppress Recommendation, Not Existence

**Date**: August 13, 2026
**Status**: Accepted
**Deciders**: Owner
**Context**: Quiver ranked Imperial Beach #1 with an EPIC verdict while the water there is chronically sewage-impacted. Recommending a polluted beach is a brand and trust liability.

---

## Context and Problem Statement

A small set of Southern California beaches are chronically impacted by water quality
(Imperial Beach, Imperial Beach Pier, Silver Strand State Beach, Coronado North Jetty,
Hotel Del Coronado). Quiver's ranking and discovery surfaces scored them on wave quality alone and
could present them as the best available option.

The water-quality data pipeline is ~99.5% empty, so this cannot be solved by "just show the water
quality signal" — for most beaches there is no sample to show. The hold list is therefore an
explicit, owner-curated set, not a derived one.

The question is not *whether* to stop recommending them. It is **how much of the product should
disappear** as a result.

---

## Decision: split on **who chose the beach** ✅ **SELECTED**

**Hidden — wherever Quiver picks or ranks the beach for the user:**
featured, popular, coach picks, nearby recommendations, surf discovery, week scout, regional
summary / best days, city "best right now", intent/location pages, guides, beginner editorial,
Coast Pulse, OG recommendation images, and any Quiver-initiated notification that names a beach.

**Visible — wherever the user already chose the beach:**
- the canonical beach page, **including its forecast and conditions**
- search by name, and the sitemap
- the user's own sessions, comments, and profile home beach
- **alerts the user configured on that beach are delivered**

### Rationale

- Quiver should never *recommend* water it would not send a friend into. That is the actual brand
  risk, and it lives entirely in the surfaces where Quiver does the choosing.
- A user typing a beach name, opening its page, or setting an alert on it is expressing intent.
  Overriding that is paternalistic and produces dead ends for exactly the people most affected —
  the locals who surf there.
- Removing the beach outright would also remove its check-ins and observations, starving the
  community signal around the places that most need better local context.

### Directionality of failure

- **Inside ranking/discovery: fail closed.** An unresolved or errored water-quality lookup
  *excludes* the beach. Never rank an unknown as safe.
- **Outside ranking/discovery: fail open.** An error must not blank the beach page. A page the
  policy says is visible stays visible.

### Notifications

The notification adapter defaults to applying holds and exempts only explicitly user-configured
types:

```ts
applyWaterQualityHolds: !USER_CONFIGURED_NOTIFICATION_TYPES.has(input.type)
```

This is deliberate: a **new** notification type is filtered by default. The prior form was an
allowlist of types to filter, which meant any newly added Quiver-initiated notification leaked
until someone remembered to add it.

The correctness of `USER_CONFIGURED_NOTIFICATION_TYPES` is load-bearing in both directions — a
missing entry wrongly *suppresses* a user's own alert, which violates this ADR just as much as a
leak does.

### Hold list storage

`water_quality_held_beaches` (beach_id, reason, created_at) — a table, so the list is editable
without a migration. The TypeScript array is retained only as the migration seed manifest.

---

## Alternatives considered

### Hide the beaches entirely ❌ **REJECTED**

Originally selected, then reversed. Under this policy the beach page 404s, the forecast vanishes,
and user-set alerts are suppressed.

Rejected because it breaks users who already have the beach as their home break, produces silent
dead ends that read as broken coverage rather than caution, and starves the community data loop.

It was also structurally expensive. Enforcing it required treating **every** beach read as a leak
risk: five independent critic rounds each closed the enumerated surfaces and each found a new set
(round 5 alone found 8 new P0s). The attempted architectural fix — renaming `beaches` to
`beaches_all` and serving a filtered view — hid all 78 direct reads plus forced 19 PostgREST embed
repoints, and would have required opt-outs on the very surfaces this ADR keeps visible.

Recorded here so it is not re-proposed: the difficulty was a symptom of the policy, not of the
implementation. The narrow policy is ~60 files; "hidden entirely" was ~238 and still not converged.

### Public "not recommended" annotation on the beach page ❌ **NOT ADOPTED**

Argued for by a commercial reviewer: keep the page and show a prominent water-quality warning with
alternatives. Not adopted now because the water-quality data is ~99.5% empty, so most pages could
only say "status unknown" — which is not a safety signal and risks implying the *other* beaches
have been verified clean.

Reconsider if and when sampling coverage is real. This ADR does not preclude it.

---

## Consequences

- Quiver never recommends a held beach; users can still reach, watch, and log one deliberately.
- "Held" is not a user-visible product state. There is no badge and no explanation on the page.
  A user who navigates there sees a normal beach page. Accepted for now — revisit with the
  annotation option above.
- New ranking/discovery surfaces must apply the hold. This is a convention, not an enforced
  boundary; a repo-wide lint rule was built for the "hide entirely" policy and retired with it.
- The migration is written but **unapplied**. Production and development share one Supabase
  instance, so applying it is an owner action.
