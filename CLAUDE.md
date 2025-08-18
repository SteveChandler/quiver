## Quiver – Claude Contributor Guide

This repo is optimized for AI-assisted coding. Follow this guide to produce compliant, high‑quality edits that align with Quiver’s growth-first strategy.

### Mission

- Prioritize user growth and viral mechanics over monetization. Focus on: social sharing, session photos, referrals/challenges/leaderboards, and community features.

### Required Workflow

1. Analyze the request and scan relevant `ARCHITECTURE.md` files first.
2. Propose a concise Implementation Plan (use the repo’s plan template) and wait for approval.
3. Implement using established patterns (below). Keep code changes minimal and targeted.
4. Validate: run tests/build where applicable; avoid introducing linter/type errors.
5. Document: update `CHANGELOG.md` under Unreleased.

### Core Patterns (must follow)

- Data Fetching: Always use `useDataFetcher` with a memoized fetch function.

```tsx
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

const fetchData = useCallback(async () => {
  // Call an action or API here
  return await myActionOrApi();
}, [myActionOrApi]);

const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

- Server Actions: Use authenticated wrappers from `lib/server-action-utils.ts`.

```ts
import { withAuthenticatedAction } from "@/lib/server-action-utils";

export async function doProtectedThing(arg: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // user is authenticated; use supabase server client
    const { data, error } = await supabase
      .from("some_table")
      .select("*")
      .eq("owner_id", user.id);
    if (error) throw new Error(error.message);
    return data;
  });
}
```

- API Routes: Use centralized API utils from `lib/api-utils.ts`.

```ts
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const data = await doWork();
    return createSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- Realtime Subscriptions (client): Create and clean up Supabase channels.

```tsx
useEffect(() => {
  const channel = supabase
    .channel("changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "table" },
      handleChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [supabase]);
```

### Directory and Documentation Rules

- Always read the directory’s `ARCHITECTURE.md` before editing:
  - `app/ARCHITECTURE.md` – App Router, API route patterns
  - `components/ARCHITECTURE.md`, `components/ui/ARCHITECTURE.md` – DRY component patterns
  - `hooks/ARCHITECTURE.md` – `useDataFetcher` and hook patterns
  - `lib/ARCHITECTURE.md` – utilities, services, server action wrappers
  - `types/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md`, `styles/ARCHITECTURE.md`, `test-utils/ARCHITECTURE.md`
- Start with `docs/ARCHITECTURE_REVIEW.md` for system-wide context.
- Cursor agents & MCP: see `docs/CURSOR_AGENTS.md`; MCP configuration lives in `.cursor/mcp.json`.

### Critical Don’ts

- Don’t invent data fetching patterns (must use `useDataFetcher`).
- Don’t skip `withAuthenticatedAction` for protected server actions.
- Don’t bypass `lib/api-utils.ts` for API responses/errors.
- Don’t reformat unrelated code or change indentation styles.
- Don’t add monetization or non-growth features without direction.

### Testing Expectations

- Write/adjust tests when adding behavior: unit (utils), integration (server actions/API), component tests, and E2E for critical flows.
- Follow existing testing patterns in `__tests__/` and `e2e/`.
- Prefer pragmatic E2E waits (`waitForLoadState("load")`) and flexible API status assertions where applicable.

### Changelog

- Update `CHANGELOG.md` under `[Unreleased]`:
  - Add a brief bullet under the appropriate section (Added/Changed/Fixed/Performance/Removed).
  - Keep entries concise and reference the patterns used when relevant.

### Code Style

- TypeScript-first, explicit function signatures for public APIs, meaningful names.
- Early returns, guard error cases first; no empty catches.
- Minimal comments; explain “why” when non-obvious.
- Preserve existing formatting and indentation exactly.

### Growth Focus (what to prioritize)

- Social sharing (session summaries), session photo integration, viral loops (referrals/challenges/leaderboards), and community features.
- Forecast transparency improvements and adding forecast data to sessions where relevant.

### Quick Checklist (before submitting an edit)

- Read the relevant `ARCHITECTURE.md` docs.
- Present plan and get approval.
- Use `useDataFetcher`, `withAuthenticatedAction`, and `lib/api-utils.ts` correctly.
- Add cleanup for any realtime subscriptions.
- Add/update tests when behavior changes.
- Update `CHANGELOG.md`.
