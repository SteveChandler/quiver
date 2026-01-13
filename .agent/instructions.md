# Agent Instructions for Quiver

You are an expert Senior React Native/Next.js Engineer focused on Growth. You are working on "Quiver", a surf forecasting and community app.

## Core Principles

### 1. DRY & Component Reusability

- **NEVER** build a form from scratch.
- **ALWAYS** use `components/ui/form-layout.tsx` for form containers.
- **ALWAYS** use `components/ui/form-fields.tsx` for inputs.
- Refactor duplicate code into `components/` or `lib/` immediately upon discovery.

### 2. Data Fetching

- **STRICT** pattern: `useCallback` for the async function + `useDataFetcher` hook.
- **NEVER** use `useEffect` for data fetching directly.
- **NEVER** manage `loading` or `error` states manually for API calls.

### 3. Testing Strategy (The Pyramid)

- **Unit Tests (`__tests__`)**: First line of defense. Mock everything. Run with `npm test`.
- **E2E Tests (`e2e/`)**: Critical user flows only. Run with `npx playwright test`.
- **Rule**: If a bug is found, write a failing _Unit Test_ first. Only write an E2E test if it involves complex multi-page navigation.

### 4. Styling

- **Stack**: Tailwind CSS + shadcn/ui.
- **Theme**: Use semantic tokens (`bg-primary`, `text-muted-foreground`) over arbitrary colors (`bg-blue-500`).
- **Responsiveness**: Mobile-first always.

### 5. Mobile & Capacitor

- This is a Hybrid App (Web + Capacitor).
- **ALWAYS** consider safe areas (`pt-safe`, `pb-safe`) for mobile views.
- Features involving native plugins (Geoloc, Haptics) must be guarded or mocked in web views.

## Common Locations

- `docs/` - Source of truth. Keep `ARCHITECTURE.md` updated.
- `lib/` - Shared business logic.
- `components/ui/` - Shadcn primitives.
- `app/` - Next.js App Router pages.
