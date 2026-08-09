# Actions Architecture

## Purpose

Centralize server actions used by UI and API routes. Actions are the single entry point for database mutations and authenticated reads. They enforce security, consistent error handling, and cache revalidation.

## Structure

- Top-level modules: `session-actions.ts`, `profile-actions.ts`, `session-media-actions.ts`, `like-actions.ts`, `social-actions.ts`, `intel-actions.ts`, `analytics-actions.ts`, `check-in-actions.ts`, `board-actions.ts`, `forecast-actions.ts`, `forecast-calibration-actions.ts`, `setup-actions.ts`, `personalization-actions.ts`
- Subdomain folder `beach/` for favorites, location utilities, and queries
- Subdomain folder `city/` for city editorial content

**personalization-actions.ts** - Personalization status queries for progress UI. Main export: `getPersonalizationStatus()` - Returns `PersonalizationStatus`: `sessionCount`, `intelPostCount`, `hasLearnedPrefs`/`learnedConfidence`, `hasImplicitPrefs`/`implicitConfidence`, `learnedWaveRange` (min/max ft or null), `activeLayers` (0-4). Uses `withAuthenticatedAction`. Data from: user_surf_preferences, user_implicit_preferences, sessions, intel_posts. Handles PGRST116 (no row) gracefully for new users. Used by: `components/home-screen/personalization-progress.tsx`, `components/home-screen/index.tsx`

## Required Patterns

- Use wrappers from `lib/server-action-utils.ts`:
  - `withServerAction(fn)` — wraps with `{ success, data?, error? }`
  - `withAuthenticatedAction((user, supabase) => ...)` — enforces auth and provides server client
  - `withDatabaseOperation(op)` — concise pattern for single DB calls
- Revalidate affected pages after mutations with `revalidatePath()`
- Validate ownership explicitly with `.eq("user_id", user.id)` even with RLS enabled

## Example

```ts
export async function createPlannedSession(data: SessionInput, userId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    if (user.id !== userId) throw new Error("User ID mismatch");
    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        ...data,
        user_id: user.id,
        status: "planned",
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/sessions");
    return session;
  });
}
```

## Error & Response Shape

- Return `{ success: boolean, data?: T, error?: string }`
- Never expose raw DB errors directly to callers; throw and let the wrapper format
- **Special error signals**: Some actions throw semantic error messages that the UI interprets:
  - `"CITY_EXISTS_NO_DATA"` - City exists in DB but has no ranked/curated page data. UI should redirect to map with search filter instead of showing 404.

## Security

- Use `createSupabaseServerClient()`; service-role is limited to controlled, documented admin utilities

## Testing Guidance

- Unit/integration: mock Supabase; assert auth required, ownership enforced, revalidation triggered, realistic DB error branches
- E2E (Playwright): cover plan/log session, reviews, intel, profile edits

## Related Docs

- `docs/ARCHITECTURE.md`
- `lib/ARCHITECTURE.md`
- Component-specific docs in `components/**/ARCHITECTURE.md`
