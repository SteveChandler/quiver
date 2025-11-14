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


## Workstream A — Supabase Schema & Metadata ✅ **COMPLETE**

> Deliverable: migration series in `supabase/migrations/` plus updated Supabase policies.

- [x] **Admin flag.** ✅ Added `is_admin boolean not null default false` to `public.profiles` with index for performance. Seed at least one admin user manually.
  - Migration: `20251024000001_add_admin_infrastructure.sql`
  - Created admin_audit_log table with RLS policies
  - Current requirement: set `is_admin = true` for user `bcdc5d59-2e22-4006-98a6-cada8618577a` in staging + production.
  - ⚠️ Note: Admin user seeding is production-specific (user must exist first in auth.users)

- [x] **Soft-delete columns.** ✅ Added `deleted_at timestamptz` to all managed tables (Sessions, Beach Reviews, Session Media, Beach Photos, Beaches) with indexes.
  - Migration: `20251024000002_add_soft_delete_columns.sql`
  - Created helper functions: `soft_delete_entity()` and `restore_entity()`
  - Intel posts use `is_active` instead (documented in migration)

- [x] **History tables.** ✅ Created 5 history tables with audit triggers.
  - Migration: `20251024000003_create_history_tables.sql`
  - Migration: `20251024000004_create_audit_triggers.sql`
  - Migration: `20251024000008_sync_history_table_schemas.sql` (schema sync fix)
  - Tables: beaches_history, sessions_history, beach_reviews_history, beach_photos_history, session_media_history
  - Created `log_revision()` trigger function (BEFORE UPDATE OR DELETE)
  - Created `get_entity_history()` helper function
  - ✓ Validated: Audit system working correctly with functional tests

- [x] **RLS adjustments.** ✅ Added comprehensive admin RLS policies to all managed tables.
  - Migration: `20251024000005_add_admin_rls_policies.sql`
  - Created `is_admin_user()` helper function
  - 22 admin policies covering SELECT, INSERT, UPDATE, DELETE on all tables
  - Admins can view soft-deleted records and full history

- [x] **Storage consistency.** ✅ Documented in migration comments.
  - Migration: `20251024000007_document_storage_contracts.sql`
  - Session-media bucket contract: soft delete DB row + remove storage object

- [x] **Backups.** ✅ Documented rollback procedures in each migration file.
  - All migrations include ROLLBACK INSTRUCTIONS sections
  - All migrations include VALIDATION QUERIES for verification

- [x] **Admin badge seeding.** ✅ Badge creation logic included in admin infrastructure migration.
  - Migration: `20251024000001_add_admin_infrastructure.sql`
  - Safely handles case where badge_definitions table doesn't exist yet
  - Creates team_admin badge and assigns to canonical admin user

**Implementation Summary:**
- ✅ 8 migration files created and tested
- ✅ All infrastructure validated on local database
- ✅ Audit triggers working correctly (functional tests passed)
- ✅ 5 history tables tracking changes
- ✅ 8 audit triggers installed
- ✅ 22 admin RLS policies active
- ✅ Helper functions created: soft_delete_entity, restore_entity, get_entity_history, is_admin_user
- ✅ No TypeScript errors introduced

**Production Deployment Notes:**
1. Run migrations in order (000001 through 000008)
2. Manually set `is_admin = true` for designated admin user(s)
3. Verify admin badge exists if gamification system is active
4. Test audit logging with a non-critical entity update
5. Monitor Supabase logs for any trigger warnings


## Workstream B — Access Control & Backend Helpers ✅ **COMPLETE**

> Deliverable: request gating that reuses `lib/auth` utilities and ensures every admin write uses the service role client.

- [x] **Extend admin helpers.** ✅ In `lib/auth/admin.ts`, added:
  - `export async function requireAdminOrThrow()` that throws `UnauthorizedError` or `ForbiddenError`.
  - `export function assertIsAdmin(user?: AdminUser | null): asserts user is AdminUser`.
  - `export async function isAdminFromCookie()` for middleware checks without DB queries.
  - `ADMIN_USER_IDS` constant seeded with `bcdc5d59-2e22-4006-98a6-cada8618577a` so the canonical admin works even before metadata is populated.
  - Updated `isAdmin()` to check canonical IDs as failsafe.
- [x] **Custom error classes.** ✅ Created `lib/errors/admin-errors.ts`:
  - `UnauthorizedError` (401) for authentication failures.
  - `ForbiddenError` (403) for authorization failures.
  - Helper function `createAuthError()` to determine appropriate error.
- [x] **Server action wrapper.** ✅ Created `lib/server-action-utils/admin.ts`:
  - `withAdminAction<TArgs, TResult>()` - Admin-only server actions with service role client.
  - `withAdminActionAndUser<TArgs, TResult>()` - Variant that provides both user and service role client.
  - Consistent error handling matching existing `ServerActionResponse<T>` pattern.
  - Full TypeScript support with proper generic types.
- [x] **API route guard.** ✅ Created `lib/api-utils/admin.ts`:
  - `withAdminRoute()` - Admin-only API route wrapper with service role client.
  - `withAdminRouteAndUser()` - Variant that provides both user and service role client.
  - `createUnauthorizedResponse()` and `createForbiddenResponse()` helpers.
  - `checkIsAdmin()` helper for conditional logic in mixed routes.
  - Proper HTTP status codes (401/403) with security headers.
- [x] **Middleware gate.** ✅ Updated `middleware.ts`:
  - Added `/admin` path protection with admin privilege checks.
  - Checks both authentication AND admin status (via `ADMIN_USER_IDS`).
  - Redirects non-admins to home page (`/`).
  - Redirects unauthenticated users to sign-in with `redirectTo` parameter.
  - TODO: Will check user metadata once `is_admin` flag is in database (Workstream A).
- [x] **Environment safety.** ✅ Created `lib/config/admin.ts`:
  - `validateAdminConfig()` - Boot-time validation of required environment variables.
  - `getAdminConfig()` - Safe config retrieval with feature flags.
  - `isAdminPortalEnabled()` - Feature flag support via `ADMIN_PORTAL_ENABLED` env var.
  - Validates `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Throws `AdminConfigError` on missing configuration (except in test environments).
- [x] **Audit logging.** ✅ Created `lib/logging/admin-audit.ts`:
  - `recordAdminEvent()` - Log individual admin actions to `admin_audit_log` table.
  - `recordAdminEventBatch()` - Bulk logging for multiple operations.
  - `getAuditLogsForEntity()` - Query logs by entity type and ID.
  - `getAuditLogsForUser()` - Query logs by admin user.
  - `getAuditLogStats()` - Analytics and reporting for time periods.
  - Full TypeScript support with `AdminAction` and `AdminEntity` types.

**Implementation Notes:**
- All files follow established architectural patterns from existing codebase.
- Service role client used for all admin operations to bypass RLS.
- Error handling consistent with `lib/api-utils.ts` and `lib/server-action-utils.ts`.
- TypeScript compilation successful - no new errors introduced.
- Ready for integration with Workstream A database migrations.

**Usage Examples:**
```typescript
// Server Action
import { withAdminAction } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";

export const deleteBeach = withAdminAction(
  async (beachId: string, { supabaseAdmin }) => {
    const { data } = await supabaseAdmin
      .from('beaches')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', beachId)
      .select()
      .single();

    await recordAdminEvent(user.id, "beach", "delete", {
      entityId: beachId,
      description: "Soft deleted beach via admin portal",
      payloadSummary: { beach_name: data.name }
    });

    return { success: true };
  }
);

// API Route
import { withAdminRoute } from "@/lib/api-utils/admin";
import { createSuccessResponse } from "@/lib/api-utils";

export const DELETE = withAdminRoute(async (request, { supabaseAdmin }) => {
  const { id } = await request.json();
  await supabaseAdmin
    .from('beaches')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return createSuccessResponse({ deleted: true });
});
```


## Workstream C — Admin Shell & Navigation ✅ **COMPLETE**

> Deliverable: `/app/admin/layout.tsx`, supporting navigation components, and top-level link injection.

- [x] **Layout build.** ✅ Created `app/admin/layout.tsx` with responsive shell:
  - Desktop: Collapsible sidebar using Shadcn Sidebar component with keyboard shortcut (Cmd/Ctrl+B)
  - Mobile: Sheet component for sidebar navigation
  - Breadcrumb navigation with `AdminBreadcrumbs` client component
  - Navigation items: Overview, Forecasts, Beaches, Photos, Intel, Sessions, Reviews
  - Files: `app/admin/layout.tsx`, `components/admin/admin-breadcrumbs.tsx`
- [x] **Nav link gating.** ✅ Added admin link to `AppHeader` component:
  - Desktop navigation shows "Admin" link for admin users (after "Community")
  - Mobile hamburger menu includes "Admin" item for admin users
  - Client-side check: `profile?.is_admin === true`
  - Server-side enforcement via middleware (Workstream B)
  - File: `components/app-header.tsx` (modified)
- [x] **Empty shell pages.** ✅ Created stub routes for all admin sections:
  - `app/admin/page.tsx` - Overview with quick navigation cards
  - `app/admin/beaches/page.tsx` - Beach management stub
  - `app/admin/photos/page.tsx` - Photo moderation stub
  - `app/admin/intel/page.tsx` - Intel management stub
  - `app/admin/sessions/page.tsx` - Session management stub
  - `app/admin/reviews/page.tsx` - Review moderation stub
  - Each page includes: title, description, feature list, related links
- [x] **Shared components.** ✅ Created `AdminPageHeader` for consistent styling:
  - File: `components/admin/admin-page-header.tsx`
  - Props: title, description, action slot for buttons
  - Used across all admin pages
- [x] **SEO.** ✅ Added metadata exports:
  - Root admin layout includes title template and `robots: "noindex, nofollow"`
  - All server component pages include proper metadata
  - Client components inherit from layout metadata
- [x] **Forecasts page update.** ✅ Updated existing forecasts page:
  - Added `AdminPageHeader` component
  - Updated spacing to match new admin shell
  - Maintained all existing functionality

**Implementation Summary:**
- ✅ 8 new files created, 2 existing files modified
- ✅ Build successful - no TypeScript errors in admin code
- ✅ Authentication flow verified (redirects to sign-in)
- ✅ Responsive design (desktop sidebar + mobile sheet)
- ✅ Breadcrumb navigation working dynamically
- ✅ All routes accessible and rendering correctly

**Testing Results:**
- TypeScript: No errors in new admin portal code
- Build: All admin pages compiled successfully
- Runtime: Server starts without errors, routes accessible
- Auth: Proper redirect for unauthenticated users (`/admin` → `/auth/sign-in?redirectTo=/admin`)

**Ready for Workstream D:** Feature module implementation can now begin.


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

### Beaches ✅ **COMPLETE** (2025-10-23)
- [x] **List view.** ✅ Client component with `useDataFetcher` pulling beaches from `listBeaches()` server action (filters `deleted_at is null` by default). Provides comprehensive search on `name`/`region`/`location`/`country` with real-time filtering.
  - Component: `components/admin/beach-table.tsx`
  - Features: Sortable columns (name, region), real-time search, show/hide deleted toggle
- [x] **Create/Edit form.** ✅ Modal dialog using `react-hook-form` + Zod schema validation (client + server). Writes to `beaches` via service role using `withAdminActionAndUser` wrapper.
  - Component: `components/admin/beach-form-dialog.tsx`
  - Validation: `lib/validation/admin/beach-schema.ts`
  - Server actions: `createBeach()` and `updateBeach()` in `actions/admin/beaches.ts`
  - Fields: name*, region*, location, country, lat/lng, break_type, skill_level, is_private
- [x] **Soft delete + restore.** ✅ Toggles `deleted_at` with confirmation modal showing impact summary. Both operations logged to audit trail.
  - Server actions: `softDeleteBeach()` and `restoreBeach()` in `actions/admin/beaches.ts`
  - Component: `components/admin/confirm-action-dialog.tsx` (reusable confirmation dialog)
  - Audit logging: All operations logged via `recordAdminEvent()`
- [x] **History drawer.** ⏭️ Deferred to future iteration. Basic audit logging via `admin_audit_log` provides action trail. Full change history available via `beaches_history` table (Workstream A) - UI for viewing diffs can be added later if needed.

**Implementation Summary:**
- ✅ 6 new files created
- ✅ Full CRUD operations with soft delete/restore
- ✅ Client-side search and filtering
- ✅ Zod validation on client and server
- ✅ Audit logging for all mutations
- ✅ Reusable confirmation dialog component
- ✅ TypeScript compilation successful
- ✅ Build passes without errors
- ✅ Follows established admin portal patterns from Workstreams A-C

### Photos ✅ **COMPLETE** (2025-10-23)
- [x] **Data shaping.** ✅ Created unified `PhotoModerationItem` interface combining `session_media` and `beach_photos` with type discrimination.
  - Interface: `PhotoModerationItem` in `actions/admin/photos.ts`
  - Fields: id, type, imageUrl, thumbUrl, uploadedAt, fileSize, status, approved, metadata
  - Server actions: `listSessionMedia()` and `listBeachPhotos()` transform DB rows to unified format
- [x] **Approve flow.** ✅ Toggle `approved` boolean on `beach_photos` with optimistic UI feedback. Approved photos automatically included in `beach_photos_featured` view.
  - Server action: `toggleBeachPhotoApproval()` in `actions/admin/photos.ts`
  - Component: Approve/unapprove buttons in table and preview dialog
  - Audit logging: All approval changes logged via `recordAdminEvent()`
- [x] **Delete flow.** ✅ Soft delete sets `deleted_at` timestamp. Session media also removes storage object from `session-media` bucket. Error handling ensures DB record is always marked deleted even if storage cleanup fails.
  - Server actions: `softDeleteSessionMedia()` and `softDeleteBeachPhoto()` in `actions/admin/photos.ts`
  - Storage cleanup: `supabaseAdmin.storage.from("session-media").remove([path])`
  - Restore actions: `restoreSessionMedia()` and `restoreBeachPhoto()`
- [x] **Filtering.** ✅ Tabbed interface with "Session Media" and "Beach Photos". Per-tab filters: show deleted checkbox, approved-only checkbox (beach photos), real-time search.
  - Component: `app/admin/photos/page.tsx` with Shadcn Tabs
  - Filters update via state and trigger data refetch via `useDataFetcher`
  - Stats cards show totals (session media, beach photos, approved, pending, deleted)

**Implementation Summary:**
- ✅ 5 new files created
- ✅ Unified photo moderation interface for 2 table types
- ✅ Tabbed navigation separating session media from beach photos
- ✅ Photo preview lightbox with full metadata display
- ✅ Approval workflow for beach photos
- ✅ Soft delete + restore with storage cleanup for session media
- ✅ Search functionality across captions and metadata
- ✅ Stats dashboard cards
- ✅ Audit logging for all mutations
- ✅ TypeScript compilation successful
- ✅ Build passes without errors
- ✅ Follows established admin portal patterns from Workstreams A-C

**Files Created:**
- `lib/validation/admin/photo-schema.ts` - Zod schemas for photo operations
- `actions/admin/photos.ts` - Server actions (list, delete, restore, approve, stats)
- `components/admin/photo-table.tsx` - Unified table component with thumbnails
- `components/admin/photo-preview-dialog.tsx` - Lightbox preview with metadata
- `app/admin/photos/page.tsx` - Full implementation replacing stub

### Intel ✅ **COMPLETE** (2025-10-23)
- [x] **Status toggle.** ✅ Map UI switch to `is_active` boolean. Include optimistic toast feedback.
  - Server action: `toggleIntelActive()` in `actions/admin/intel.ts`
  - Confirmation dialog with activate/deactivate variants
  - Audit logging: All status changes logged via `recordAdminEvent()`
- [x] **Editor.** ✅ Edit dialog for title, description, and tag (no Markdown - plain text per existing intel schema).
  - Component: `IntelEditDialog` in `components/admin/intel-edit-dialog.tsx`
  - Validation: `updateIntelContentSchema` in `lib/validation/admin/intel-schema.ts`
  - Server action: `updateIntelContent()` in `actions/admin/intel.ts`
  - Fields: tag (dropdown), title (100 chars), description (500 chars)
- [x] **Audit.** ✅ Log each toggle and content update into `admin_audit_log`.
  - Logged actions: "activate", "deactivate", "update"
  - Tracked changes: status transitions, content modifications

**Implementation Summary:**
- ✅ 5 new files created
- ✅ Full CRUD operations (list, stats, toggle active, update content)
- ✅ Stats dashboard with active/inactive counts and tag distribution
- ✅ Searchable/sortable table with real-time filtering
- ✅ Zod validation on client and server
- ✅ Audit logging for all mutations
- ✅ Reusable confirmation dialog
- ✅ TypeScript compilation successful
- ✅ Build passes without errors
- ✅ Follows established admin portal patterns from Workstreams A-C

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
- Do we need granular permissions (e.g. content moderators vs. super admins), or is a single `is_admin` flag sufficient? single admin is fine for now in the future we'll need two
- Should admin actions send notifications (Slack/email) when high-impact operations occur? no
- Is real-time refresh required on any admin page, or is manual refresh acceptable? manual refresh is fine...a button is nice too
- Do we need CSV export for audits (especially sessions or reviews)? no

Track answers in this document to keep implementation aligned across the team.
