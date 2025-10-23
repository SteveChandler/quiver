# Admin Portal Implementation Plan

This plan translates the high-level Admin Portal concept into engineering tasks that a full-stack developer can pick up immediately. It assumes the current Next.js App Router codebase, Supabase for auth/data/storage, Tailwind + Shadcn UI primitives, and the existing `/admin/forecasts` page as the initial reference implementation.


## Goals & Success Criteria
- Ship an authenticated admin area anchored at `/admin` with collections for **Forecasts, Beaches, Photos, Intel, Sessions, Reviews**.
- Restrict all admin routes, server actions, and API handlers to users flagged as admins in Supabase.
- Ensure destructive operations are reversible (soft delete) and auditable (history tables or logging).
- Provide consistent UX using existing design tokens/components; administrators should complete the core CRUD / moderation flows without leaving the portal.
- Deliver automated coverage (unit for server actions, Playwright smoke for flows) plus a manual QA checklist to unblock release.


## Scope & Assumptions
- Next.js App Router with TypeScript in `app/`.
- Supabase auth already wired via `createSupabaseServerClient` and `createSupabaseServiceRoleClient`.
- `lib/auth/admin.ts` exists; extend rather than replace.
- The global nav lives in components under `components/nav` and reads profile data via `lib/auth`.
- Migrations run through Supabase CLI (`supabase db push`) and live in `supabase/migrations/{timestamp}__*.sql`.
- No multi-tenant requirement; admins manage a single production dataset.


## Implementation Sequencing
1. **Schema + metadata groundwork** — admin flag, soft deletes, history tables.
2. **Access control layer** — middleware, helpers, server action wrappers, environment validation.
3. **Admin shell & navigation** — layout, sidebar, breadcrumbs, breadcrumb path handling.
4. **Feature modules** — one module per entity with UI + server actions + storage integration.
5. **Shared UX polish** — loading states, empty states, confirmation modals, error surfacing.
6. **Testing & rollout** — automated tests, manual checklist, release guardrails.


## Workstream A — Supabase Schema & Metadata

> Deliverable: migration series in `supabase/migrations/` plus updated Supabase policies.

- [ ] **Admin flag.** Add `is_admin boolean not null default false` to `public.profiles`; expose it via Supabase JWT (Auth > Policies > JWT claim). Seed at least one admin user manually.
  - Current requirement: set `is_admin = true` for user `bcdc5d59-2e22-4006-98a6-cada8618577a` in staging + production.
  ```sql
  update public.profiles
     set is_admin = true,
         updated_at = now()
   where id = 'bcdc5d59-2e22-4006-98a6-cada8618577a';
  ```
- [ ] **Soft-delete columns.** For each managed table add `deleted_at timestamptz` (Sessions, Beach Reviews, Session Media, Beach Photos, Beaches) and ensure default queries filter `deleted_at is null`. Intel already uses `is_active`; document this exception in comments.
  ```sql
  alter table public.sessions add column if not exists deleted_at timestamptz;
  create index if not exists sessions_deleted_at_idx on public.sessions (deleted_at);
  ```
- [ ] **History tables.** Create `{table}_history` tables (e.g. `beaches_history`, `beach_reviews_history`) with `changed_at timestamptz default now()` and `changed_by uuid`. Add `BEFORE UPDATE OR DELETE` triggers invoking a shared function that copies `OLD` rows.
  ```sql
  create or replace function public.log_revision() returns trigger as $$
  begin
    execute format('insert into %I select ($1).*', TG_TABLE_NAME || '_history') using OLD;
    return OLD;
  end;
  $$ language plpgsql security definer;
  ```
- [ ] **RLS adjustments.** Prefer service-role writes. If RLS needs updates, add policies that allow `auth.uid()` in `profiles` with `is_admin = true` to `select/update/delete`.
- [ ] **Storage consistency.** Document the `session-media` bucket contract: deleting media requires both storage removal and marking the DB row `deleted_at`. Include this in migration comments.
- [ ] **Backups.** Before deploying migrations, export the relevant tables (`supabase db dump --data-only --schema public --table beaches,...`) for rollback.
- [ ] **Admin badge seeding.** Create/ensure badge definition (e.g. `team_admin`) exists and assign it to the canonical admin user so their profile displays an admin badge.
  ```sql
  insert into public.badge_definitions (badge_slug, name, description, icon, category, xp_reward)
  values (
    'team_admin',
    'Quiver Team',
    'Official Quiver admin account',
    'ShieldCheck',
    'global',
    0
  )
  on conflict (badge_slug) do update set name = excluded.name,
                                    description = excluded.description,
                                    icon = excluded.icon,
                                    category = excluded.category;

  insert into public.user_badges (user_id, badge_slug)
  values ('bcdc5d59-2e22-4006-98a6-cada8618577a', 'team_admin')
  on conflict (user_id, badge_slug) do nothing;
  ```


## Workstream B — Access Control & Backend Helpers

> Deliverable: request gating that reuses `lib/auth` utilities and ensures every admin write uses the service role client.

- [ ] **Extend admin helpers.** In `lib/auth/admin.ts`, add:
  - `export async function requireAdminOrThrow()` that throws `UnauthorizedError`.
  - `export function assertIsAdmin(user?: AdminUser | null): asserts user is AdminUser`.
  - `ADMIN_USER_IDS` constant seeded with `bcdc5d59-2e22-4006-98a6-cada8618577a` so the canonical admin works even before metadata is populated; keep in sync with Supabase seed SQL.
- [ ] **Server action wrapper.** Add `lib/server-action-utils/admin.ts`:
  ```ts
  import { assertIsAdmin, getCurrentUser } from "@/lib/auth/admin";
  import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

  export function withAdminAction<TArgs extends any[], TResult>(
    action: (...args: [...TArgs, { supabaseAdmin: ReturnType<typeof createSupabaseServiceRoleClient> }]) => Promise<TResult>
  ) {
    return async (...args: TArgs) => {
      const user = await getCurrentUser();
      assertIsAdmin(user);
      const supabaseAdmin = createSupabaseServiceRoleClient();
      return action(...args, { supabaseAdmin });
    };
  }
  ```
- [ ] **API route guard.** Implement `lib/api-utils/withAdminRoute.ts` that reuses `authenticateAdmin()` and returns `NextResponse.json({ error }, { status })` on failure.
- [ ] **Middleware gate.** Update root `middleware.ts` to early-return on `/admin` path segments when `isAdminFromCookie` (new helper in `lib/auth/server`) fails. Ensure static assets and Next.js internals bypass the check.
- [ ] **Environment safety.** Add a runtime check in `next.config.mjs` (or `lib/config/admin.ts`) to throw during boot if `SUPABASE_SERVICE_ROLE_KEY` or admin JWT configuration is missing in non-test environments.
- [ ] **Audit logging.** Create `lib/logging/admin-audit.ts` with `recordAdminEvent(userId, entity, action, payloadSummary)` that inserts into a new `admin_audit_log` table (optional but recommended).


## Workstream C — Admin Shell & Navigation

> Deliverable: `/app/admin/layout.tsx`, supporting navigation components, and top-level link injection.

- [ ] **Layout build.** Create `app/admin/layout.tsx` that wraps children in a responsive shell:
  - Sticky sidebar (Desktop) listing Forecasts, Beaches, Photos, Intel, Sessions, Reviews.
  - Mobile: `Sheet` / `Drawer` triggered via `Button` with `Menu` icon.
  - Breadcrumb area that derives from route segments (e.g. `/app/admin/(beaches)/[id]/edit`).
- [ ] **Nav link gating.** Add `<AdminLink />` to the primary nav (likely `components/navigation/MainNav.tsx` or similar). Fetch the user via a server component in the layout so the link is hidden client-side.
- [ ] **Empty shell pages.** Create stub routes (`app/admin/beaches/page.tsx` etc.) that render placeholder cards verifying routing works before feature work begins.
- [ ] **Design tokens.** Centralize shared admin styles in `styles/admin.css` or a Tailwind `@layer components` block to keep spacing consistent.
- [ ] **SEO.** Add metadata exports per page (`export const metadata = { title: "Admin • Beaches" }`) to ensure proper document titles.


## Workstream D — Feature Modules

Each module follows the same pattern: data fetch via server component or RSC, action mutations wrapped with `withAdminAction`, table or card UI using Shadcn primitives, modals for confirm flows, and toast feedback (Shadcn `useToast`). Server actions live in `actions/admin/{entity}.ts`. Add end-to-end tests once core flows exist.

| Module | Primary tables / storage | Key operations | UI components | Server endpoints |
| --- | --- | --- | --- | --- |
| Forecasts (existing) | `beaches`, forecast actions | trigger re-fetch | Review existing implementation and refactor for consistency | `actions/forecast-actions` |
| Beaches | `beaches`, `beaches_history` | list, create, edit, soft delete, restore | DataTable, Drawer form (`components/ui/dialog` + `react-hook-form`), filters | `actions/admin/beaches.ts`, `app/api/admin/beaches/route.ts` |
| Photos | `session_media`, `beach_photos`, storage `session-media` bucket | approve, soft delete, restore, storage cleanup | Tabbed view ("Session Media", "Beach Photos"), lightbox preview | `actions/admin/photos.ts` |
| Intel | `intel_posts` | toggle `is_active`, edit content | Table with `Badge` for status, Markdown preview | `actions/admin/intel.ts` |
| Sessions | `sessions`, `session_media` (join) | inspect session, soft delete/restore | Expandable rows (accordion), timeline of events | `actions/admin/sessions.ts` |
| Reviews | `beach_reviews`, `beaches` | moderate review, soft delete/restore | Table with rating stars, offender profile link | `actions/admin/reviews.ts` |

### Beaches
- [ ] **List view.** Server component pulling `beaches` (filter `deleted_at is null`). Provide search on `name`/`region`.
- [ ] **Create/Edit form.** Modal form using `react-hook-form` + Zod schema. Write to `beaches` via service role.
- [ ] **Soft delete + restore.** Toggle `deleted_at`. Surface confirmation modal with summary of impacts (hides beach from mobile app).
- [ ] **History drawer.** Optional: fetch from `beaches_history` and display change log (user, timestamp, diff).

### Photos
- [ ] **Data shaping.** Combine `session_media` and `beach_photos` into a unified `PhotoModerationItem`.
- [ ] **Approve flow.** Toggle `approved` on `beach_photos` and ensure approved items bubble to main site.
- [ ] **Delete flow.** Soft delete row (`deleted_at = now()`) then remove storage object using `supabase.storage.from("session-media").remove([path])`. Wrap both operations in a single server action transaction.
- [ ] **Filtering.** Provide chips for `All / Pending / Approved / Deleted`.

### Intel
- [ ] **Status toggle.** Map UI switch to `is_active` boolean. Include optimistic toast feedback.
- [ ] **Editor.** Reuse existing Intel editor components if available (`components/intel`); otherwise create Markdown textarea with preview.
- [ ] **Audit.** Log each toggle into `admin_audit_log`.

### Sessions
- [ ] **Grid.** Display recent sessions ordered by `created_at desc`. Show user email (join on `profiles`), device info, and active flags.
- [ ] **Soft delete.** Set `deleted_at` and cascade to `session_media` if required.
- [ ] **Investigate mode.** Provide drawer with raw payload (JSON viewer) to troubleshoot support tickets.

### Reviews
- [ ] **List.** Join `beach_reviews` with `profiles` and `beaches` for context. Filter by `deleted_at`.
- [ ] **Moderation actions.** Soft delete + restore. Optionally add "Mark Featured" flag.
- [ ] **Reporting.** Provide metrics summary (total, flagged, deleted) at top of page.


## Workstream E — Shared UX Patterns & Utilities

- [ ] **Data tables.** Use a shared wrapper around `@tanstack/react-table` (check existing table components). Provide pagination, column sorting, search input.
- [ ] **Confirmation dialogs.** Implement `components/admin/ConfirmActionDialog.tsx` to standardize wording and primary/secondary buttons.
- [ ] **Toast + error handling.** Centralize notifications using `useToast`. Wrap server actions with try/catch and surface friendly error messages.
- [ ] **Loading states.** Leverage Suspense boundaries with skeleton loaders (e.g. `components/ui/skeleton`) for each page.
- [ ] **Form validation.** Co-locate Zod schemas in `lib/validation/admin/{entity}.ts` to keep server and client validation in sync.
- [ ] **Type safety.** Generate types via Supabase (`supabase gen types typescript --local > types/supabase.ts`) and import for entity definitions.


## Workstream F — Testing, QA & Rollout

- [ ] **Unit tests.** Add Jest tests for helpers (`lib/auth/admin.test.ts`, `lib/server-action-utils/admin.test.ts`) and server actions (mock Supabase client).
- [ ] **Integration tests.** Add Playwright specs under `e2e/admin/*.spec.ts` covering login gate, list rendering, and one happy-path mutation per module using seeded data.
- [ ] **Manual QA checklist.** Document expected outcomes in `docs/admin_portal_qa.md`:
  - Non-admin user cannot load `/admin` (redirect 302 to `/`).
  - Admin can list each entity, perform create/edit/delete, and see toasts.
  - Soft-deleted rows disappear from main consumer surfaces.
  - Photos delete removes storage object (verify in Supabase UI).
- [ ] **Observability.** Configure logging (`admin_audit_log`, optional Sentry breadcrumb). Surface errors in Vercel logs with action identifiers.
- [ ] **Rollout plan.**
  1. Enable feature flag (e.g. `ADMIN_PORTAL_ENABLED`) and gate nav link behind it for gradual rollout.
  2. Run migrations on staging; seed admin user; QA flows.
  3. Promote to production following Supabase backup.
  4. Monitor logs and Supabase row counts for anomalies.


## Deliverables Checklist
- [ ] Schema migrations committed and documented.
- [ ] Admin auth helpers with tests.
- [ ] `/app/admin` layout + nav integration.
- [ ] Six feature pages with corresponding server actions/API routes.
- [ ] Shared admin component library (dialogs, data table wrapper, forms).
- [ ] QA artifacts (automated tests, manual checklist, rollback notes).
- [ ] Release notes summarizing operational impacts for support staff.


## Open Questions / Follow-Ups
- Do we need granular permissions (e.g. content moderators vs. super admins), or is a single `is_admin` flag sufficient?
- Should admin actions send notifications (Slack/email) when high-impact operations occur?
- Is real-time refresh required on any admin page, or is manual refresh acceptable?
- Do we need CSV export for audits (especially sessions or reviews)?

Track answers in this document to keep implementation aligned across the team.
