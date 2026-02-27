# Routing Patterns

URL routing conventions for the Quiver application.

## Beach Pages

- **Pattern:** `app/[intent]/[city]/[beachSlug]/page.tsx`
- Accepts 2-letter state slugs for all states
- **California shortcut:** `/ca/[city]/[beachSlug]` (legacy, still active)

## Intent Pages

- **Pattern:** `app/[intent]/[city]/page.tsx`
- Must match `LocationPage` layout: Breadcrumbs, Header, Container

## State Slug Validation

- `getValidStateSlugs()` / `isValidStateSlug()` from `lib/utils/beach-url-utils.ts`

## Coverage Areas

CA, OR, WA, HI, Baja, Puerto Rico (PR), and other US territories/states with beach data in the database are in-coverage. Never show "out of area" messaging for these.

**Do NOT assume a fixed list of covered states.** The database has beaches beyond the original 5 regions. Always check the DB or test the URL before claiming something is "out of coverage."

## Session Log Templates

Link to `/features` (not `/app`).
