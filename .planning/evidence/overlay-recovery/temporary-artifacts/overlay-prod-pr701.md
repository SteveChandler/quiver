Promotes the pending main changes to prod:

- #700: Samples seven days or older show “Water quality not recently verified” and the sample date. Stale sample evidence no longer marks a beach closed, gives it a red alert pin, or excludes it from recommendations. Current official county advisories/closures and explicit holds retain precedence.
- #702: Default-off Swell Watch provider receipt acquisition and reviewed schema history. No enqueue or sends. Existing migrations are retained history and must not be reapplied. Activation remains separately gated; shadow evaluation must remain false. See docs/operations/swell-watch-no-send-launch-review.md for the operational holds.
- #703: Recover the swell overlay when tile loading delays its mount after style.load. Regression coverage also verifies overlay recovery after native-embed reactivation.

Validation: Main Gate passed build, lint, TypeScript and unit tests for the overlay fix. Local overlay checks passed 62 component tests, build/TypeScript, scoped ESLint and the mobile Chromium native-embed E2E (1/1), with a reviewed screenshot. No fresh iOS simulator run. Water-quality checks previously passed 549 scoped tests, 46 final copy/date tests and the mobile E2E. Swell Watch verification and operational limitations are recorded in #702.

Merge using a regular merge commit to preserve main/prod ancestry. This PR does not publish a native binary or OTA, activate Swell Watch, or authorize provider acquisition or sends.
