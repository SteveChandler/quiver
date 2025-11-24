## Quiver – Claude Contributor Guide

This repo is optimized for AI‑assisted coding. Follow this guide to produce compliant, high‑quality edits that align with Quiver’s **growth‑first** strategy.

### Mission

- Prioritize user growth and viral mechanics over monetization. Focus on: social sharing, session photos, referrals/challenges/leaderboards, and community features.

### Required Workflow

1. Analyze the request and scan relevant `ARCHITECTURE.md` files first.
2. Propose a concise **Implementation Plan** (use the repo’s plan template) and wait for approval.
3. Implement using established patterns (below). Keep code changes minimal and targeted.
4. Validate: run tests/build where applicable; avoid introducing linter/type errors.
5. Document: update `CHANGELOG.md` under **\[Unreleased]**.

---

### Tools & MCP (default: Playwright)

- **Default tool:** Use **Playwright MCP** for browser automation, quick UI validation, smoke checks, and screenshots. Prefer MCP actions before shelling out to the Playwright CLI.
- **Project MCP config:** The repository uses a project‑level MCP config at **`./.mcp.json`** (Claude Code) and **`./.cursor/mcp.json`** (Cursor IDE).

  - Both configs provide access to four MCP servers:
    - **Playwright**: E2E testing and browser automation
    - **Supabase**: Read-only database inspection (requires `SUPABASE_ACCESS_TOKEN` in `.env`)
    - **Rapid7**: Security log queries (requires `RAPID7_API_KEY` in `.env`)
    - **Sentry**: Error tracking and performance monitoring

  - Current configuration:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {
        "PLAYWRIGHT_STORAGE_STATE": "e2e/.auth/state.json"
      }
    },
    "supabase": {
      "command": "node",
      "args": ["scripts/run-supabase-mcp.js"]
    },
    "rapid7": {
      "command": "node",
      "args": ["scripts/run-rapid7-mcp.js"],
      "env": {
        "RAPID7_API_KEY": "${RAPID7_API_KEY}"
      }
    },
    "Sentry": {
      "url": "https://mcp.sentry.dev/mcp/quiver-z4/javascript-nextjs"
    }
  }
}
```

- **Fallback:** When MCP isn't available, use `Bash(npx playwright test <pattern>)`.

### Common Commands

- `npm run dev` – start app
- `npm run build` – build
- `npx tsc -p .` – typecheck
- `npx playwright test` – run E2E
- `npx playwright test path/to/spec.spec.ts` – focused E2E

### Permissions

- In Claude Code, use `/permissions` to **Always allow** Playwright MCP browser actions for this repo.
- **Recommended MCP permissions for Claude Code:**
  ```
  mcp__playwright__browser_navigate
  mcp__playwright__browser_snapshot
  mcp__playwright__browser_take_screenshot
  mcp__playwright__browser_click
  mcp__playwright__browser_type
  mcp__playwright__browser_wait_for
  mcp__playwright__browser_evaluate
  mcp__playwright__browser_console_messages
  mcp__playwright__browser_network_requests
  mcp__playwright__browser_close
  mcp__playwright__browser_install
  ```
- Local settings: ensure `.claude/settings.json` (or your local equivalent) allows common commands used by tests and dev tooling.

### Working Style (Claude Code)

- **Explore → Plan → Code → Commit**: First read relevant files, then propose a short plan, then implement.
- **TDD Loop**: Write/commit a failing test, implement, iterate until green. Don’t modify tests unless the spec truly changes.

---

### Core Patterns (must follow)

- **Data Fetching:** Always use `useDataFetcher` with a memoized fetch function.

```tsx
import { useCallback } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

const fetchData = useCallback(async () => {
  // Call an action or API here
  return await myActionOrApi();
}, [myActionOrApi]);

const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

- **Server Actions:** Use authenticated wrappers from `lib/server-action-utils.ts`.

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

- **API Routes:** Use centralized API utils from `lib/api-utils.ts`.

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

- **Realtime Subscriptions (client):** Create and clean up Supabase channels.

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

---

### Directory and Documentation Rules

- Always read the directory’s `ARCHITECTURE.md` before editing:

  - `app/ARCHITECTURE.md` – App Router, API route patterns
  - `components/ARCHITECTURE.md`, `components/ui/ARCHITECTURE.md` – DRY component patterns
  - `hooks/ARCHITECTURE.md` – `useDataFetcher` and hook patterns
  - `lib/ARCHITECTURE.md` – utilities, services, server action wrappers
  - `types/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md`, `styles/ARCHITECTURE.md`, `test-utils/ARCHITECTURE.md`

- Start with `docs/ARCHITECTURE_REVIEW.md` for system‑wide context.
- Agents & MCP: see `docs/CURSOR_AGENTS.md`; **MCP configuration** lives in **`.mcp.json` (Claude Code)** and **`.cursor/mcp.json` (Cursor)**.

### Critical Don'ts

- Don't invent data fetching patterns (must use `useDataFetcher`).
- Don't skip `withAuthenticatedAction` for protected server actions.
- Don't bypass `lib/api-utils.ts` for API responses/errors.
- Don't expect 500 errors in tests—these mask bugs and should trigger investigation.
- Don't use `test.skip()` in E2E tests—this hides coverage gaps and should trigger investigation.
- Don't reformat unrelated code or change indentation styles.
- Don't add monetization or non‑growth features without direction.

### Database Migration Safety (CRITICAL)

**NEVER create migrations that delete user data without explicit safeguards:**

- **PROHIBITED in migrations:**
  - `DELETE FROM auth.users` without WHERE clause
  - `DELETE FROM profiles` based on name matching
  - `TRUNCATE` on user tables
  - `DROP TABLE` for core user tables
- **REQUIRED for all migrations:**

  1. Test locally first: `supabase db reset` before applying
  2. Use transactions: wrap in `BEGIN;` ... `COMMIT;`
  3. Add existence checks: `WHERE NOT EXISTS` for inserts
  4. Create rollback migrations for every destructive change
  5. Never delete by user-provided strings (names, emails)

- **Before running migrations:**
  1. Create a backup: `./backup_script.sh`
  2. Review the SQL for any DELETE/TRUNCATE/DROP statements
  3. Test on a branch database first if available
- **Data recovery preparation:**
  - Daily backups via GitHub Actions (see `.github/workflows/database-backup.yml`)
  - Manual backups before major changes: `supabase db dump --data-only > backup.sql`
  - Keep 30 days of backup history

#### Execution Protocol (Prod)

- **Connection/Role:** Use the `claude_migrator` role only in production.
- **Default Mode:** Read-only. Any mutation requires the two-step protocol:
  1. **PLAN** — Claude must output a concise plan containing:
     - exact SQL,
     - target role (`claude_migrator`),
     - tables affected (and why protected tables are not touched),
     - backup artifact name (latest `pg_dump` file).
  2. **APPROVAL** — Maintainer must reply with `APPROVE: <sha>` (sha of the plan text).
- **No Approvals → No Changes:** Without the approval token, agents must refuse mutations.
- **Backups:** A fresh `pg_dump` is mandatory within 24h before any prod migration.

### Testing Expectations

- Write/adjust tests when adding behavior: unit (utils), integration (server actions/API), component tests, and E2E for critical flows.
- Follow existing testing patterns in `__tests__/` and `e2e/`.
- Prefer pragmatic E2E waits (`waitForLoadState("load")`) and flexible API status assertions where applicable.
- **NEVER expect 500 errors in tests** — they indicate bugs, not proper error handling. Use appropriate status codes:

  - 400 = Bad Request (missing/invalid parameters)
  - 401 = Unauthorized (authentication required)
  - 403 = Forbidden (insufficient permissions)
  - 404 = Not Found (resource doesn't exist)
  - 405 = Method Not Allowed (wrong HTTP method)

- **NEVER use `test.skip()` in E2E tests** — they hide coverage gaps and testing issues:

  - Authentication failures should throw errors, not skip tests
  - Missing test data should throw informative errors about setup requirements
  - Missing UI features should throw errors indicating the feature may be broken
  - Use proper error handling instead of silent skips

### Changelog

- Update `CHANGELOG.md` under **\[Unreleased]**:

  - Add a brief bullet under the appropriate section (Added/Changed/Fixed/Performance/Removed).
  - Keep entries concise and reference the patterns used when relevant.

### Code Style

- TypeScript‑first, explicit function signatures for public APIs, meaningful names.
- Early returns, guard error cases first; no empty catches.
- Minimal comments; explain **why** when non‑obvious.
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

* "Always validate with playwright mcp"
- When running playwright test always run a subset
- update how to run playwright
