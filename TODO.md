# TODO

## E2E Bug Follow-Ups

- [ ] Fix `/beach/[slug]` not-found and legacy deeplink handling.
  - Failing coverage: `e2e/push-deeplink-routing.spec.ts` forecast-alert deeplinks and invalid slug handling.
  - Notes: `/beach/nonexistent-beach-xyz` and some push deeplink slugs render the generic beach error state instead of a 404/not-found UX. Check the catch path in `app/beach/[slug]/page.tsx` and rethrow current Next.js `notFound()` digests.

- [ ] Fix Hawaii island-specific city filtering for Waimea.
  - Failing coverage: `e2e/location-pages.spec.ts` for `/hi/waimea-kauai`.
  - Notes: the Kauai page leaked `Hapuna Beach (Kohala)` from Big Island/Kohala. Apply the island-specific filter consistently to every beach list/table/card data source on that page.
