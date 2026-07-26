# Community spot photos

This server-only domain owns the canonical community photo contract.

- `contracts.ts` contains the fail-closed rollout flags, consent version, and
  bounded API payload parsers.
- `image-processing.ts` is the only accepted upload processor. It rotates,
  bounds pixels and dimensions, encodes WebP, and intentionally does not copy
  metadata.
- `repository.ts` is the private database/storage boundary.
- `resolver.ts` returns stable gated image URLs and structured attribution.
  User display names are never written into curated `attribution_html`.
- `ranking.ts` mirrors the database's Wilson 95% lower-bound ordering. It has no
  recency input.

The private storage bucket must never be addressed directly by clients. All
reads pass through `/api/community-photos/:id/image`, which rechecks visibility
and moderation state.
