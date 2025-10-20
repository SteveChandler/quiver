# Cursor Agents & MCP Integration

## Overview

This repository includes two Cursor agent personas wired for growth-focused development and design quality reviews. Agents can use the Playwright MCP server to run E2E tests, open traces, and validate critical flows directly from Cursor.

- Primary reference: `ARCHITECTURE.md` (top-level) and this file
- Core development patterns: see directory `ARCHITECTURE.md` files and `docs/ARCHITECTURE_REVIEW.md`
- Design principles: see `docs/DESIGN_PRINCIPLES.md`

## Personas

### Fullstack Engineer

- Mission: Implement features with a growth-first mindset (sharing, photos, referrals, community) while strictly following established patterns
- Scope:
  - Next.js 14 App Router features, API routes, and server actions
  - Supabase data access with RLS-aware patterns
  - Reusable UI via DRY components and hooks
  - Test-first changes; keep tests green
- Guardrails:
  - Always use `useDataFetcher` with memoized fetchers
  - Use `withAuthenticatedAction` wrappers for server actions
  - Use centralized API response utils in API routes
  - No ad-hoc data fetching or error handling patterns
  - Update `CHANGELOG.md` for all changes
- When to use Playwright MCP:
  - Before/after edits to validate critical flows
  - To run focused specs or open traces when debugging

### Design Review

- Mission: Provide concise, actionable UI/UX and architecture compliance reviews that maintain design consistency and performance
- Scope:
  - Review components for DRY usage, responsiveness, accessibility, and performance
  - Suggest improvements and small refactors that align with established patterns
- Guardrails:
  - Prefer annotated feedback and small, targeted edits
  - Do not introduce new patterns; reference directory `ARCHITECTURE.md`
  - Produce checklists for follow-up when changes are non-trivial
- When to use Playwright MCP:
  - Visual behavior checks (navigation, responsiveness smoke)
  - Validate performance thresholds in development context

## MCP Configuration (Playwright)

Configured via `.cursor/mcp.json`:

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
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=vawdnbbgawichorsjiwe"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "<service_role_or_personal_access_token>"
      }
    }
  }
}
```

Notes:

- Tools exposed by the Playwright MCP server support running tests, listing tests, and opening traces. Use development-friendly waits/thresholds per `e2e/ARCHITECTURE.md`.
- Playwright runs will reuse the signed-in context located at `e2e/.auth/state.json`; refresh it via `npm run test:setup` (or rerun global setup) if auth expires.
- Ensure the required test credentials (`E2E_USER_EMAIL`/`E2E_USER_PASSWORD` or `TEST_USER_*`) are set before starting Cursor so the global setup can generate the storage state.
- Local run parity: `npx playwright test` from the repo root.

## Recommended Workflows

### Fullstack Engineer

1. Read relevant directory `ARCHITECTURE.md` and `docs/ARCHITECTURE_REVIEW.md`
2. Propose an Implementation Plan and wait for approval
3. Implement using required patterns (hooks, server actions, API utils)
4. Use Playwright MCP to run focused specs or full suite
5. Update `CHANGELOG.md`; add/adjust tests if behavior changed

Example prompts:

- "Run the comprehensive smoke journey"
- "Open trace for failing session planning spec"
- "Run only API specs for recommendations"

### Design Review

1. Review UI/UX against DRY components and responsive patterns
2. Produce a short checklist with severity and impact
3. Use Playwright MCP for quick behavior validation (navigation, layout)
4. If coding changes are needed, propose a minimal edit set with rationale

Example prompts:

- "Audit component X for responsiveness and DRY compliance"
- "List quick-win accessibility fixes on page Y"
- "Run navigation spec and share findings"

## Playwright MCP Enhanced Agent Workflows

### Before MCP: Manual Testing Workflow

```
1. Developer implements feature
2. Manually run: npx playwright test
3. Read test output in terminal
4. Debug failures by examining traces manually
5. Fix issues and repeat cycle
```

### After MCP: AI-Driven Testing Workflow

```
1. Developer implements feature
2. Ask agent: "Test the new session creation flow"
3. Agent runs tests automatically and analyzes results
4. Agent opens traces, diagnoses issues, suggests fixes
5. Agent can even generate new tests for edge cases
```

### Key Enhancements for Quiver App

#### 1. **Real-time Feature Validation**

Instead of: "I think the session creation works"
Agent can: "Let me test the session creation flow end-to-end right now"

#### 2. **Intelligent Debugging**

Instead of: Reading cryptic test failures
Agent can: "I see the test failed because the beach selection dropdown isn't loading the Ocean Beach option. Let me check if the /api/beaches endpoint is working..."

#### 3. **Cross-Device Testing Orchestration**

Instead of: Manual device switching
Agent can: "Let me test this on mobile, tablet, and desktop simultaneously"

#### 4. **Performance Regression Detection**

Instead of: Hoping nothing broke
Agent can: "The landing page load time increased by 200ms - let me trace what changed"

## Governance & Quality Gates

- Always adhere to the repo’s Mandatory Working Process (plans → approval)
- Follow directory `ARCHITECTURE.md` patterns and keep edits minimal
- Prefer tests-first changes and keep the suite green
- Document all changes in `CHANGELOG.md`

Last updated: January 2025
