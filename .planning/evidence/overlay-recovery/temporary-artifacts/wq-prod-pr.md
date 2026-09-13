Promotes all currently unshipped main changes to prod. At creation, main is ahead of prod by one commit: #700 (`09af7f0bf`). No other merged main work is awaiting promotion.

Samples seven days or older now show “Water quality not recently verified” and the sample date. Stale sample evidence no longer marks a beach closed, gives it a red alert pin, or excludes it from recommendations. Current official county advisories/closures and explicit holds retain precedence.

Validation: Main Gate passed build, lint, TypeScript and full unit tests. Local policy checks passed 549 scoped tests; the final copy/date change passed 46 affected tests. The mobile Playwright regression passed with a reviewed screenshot showing the dated warning and no closure label. Production data was read only.

Merge using a regular merge commit to preserve main/prod ancestry. This PR does not include a native binary or OTA publication.
