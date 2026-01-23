# Coast Pulse NPC Fixes Design

## Problems

1. **NPC bots post "pre-dawn" content at 5 PM** — `template-hydration.ts` uses `timestamp.getHours()` which returns UTC on Vercel. At 5:20 PM PT = 1:20 AM UTC, `describeTimeOfDay(1)` returns "pre-dawn".
2. **Post text truncated at 80 chars** — `coast-pulse-formatter.ts` hard-codes `truncateText(post.description, 80)` server-side, clipping content even when there's visual space.
3. **Repetitive "pre-dawn" themes** — Caused by Bug 1. All posts in the same batch get the same wrong time-of-day.

## Fixes

### 1. Fix UTC → PT in `buildTemplateVariables`

**File:** `lib/npc/template-hydration.ts:201`

Replace `timestamp.getHours()` with PT-aware hour:

```typescript
const hour = (timestamp.getUTCHours() + 24 - 8) % 24;
```

**File:** `lib/npc/forecast-formatter.ts:74` (same fix in `formatTimeOfDay`)

```typescript
const hour = (date.getUTCHours() + 24 - 8) % 24;
```

### 2. Replace character truncation with CSS line-clamp

**File:** `lib/utils/coast-pulse-formatter.ts:422`

Remove `truncateText` call — pass full description:

```typescript
// Before:
const desc = truncateText(post.description, 80);
// After:
const desc = post.description;
```

**File:** `components/dashboard/coast-pulse.tsx` (message `<p>` tag)

Add `line-clamp-3` class:

```jsx
<p className="text-sm text-white leading-snug flex-1 line-clamp-3">
  {item.message}
</p>
```

### 3. Repetitive themes — no additional code needed

Fixed by Bug 1 correction. Jittered timestamps already provide natural variety across time-of-day boundaries. Template variety per personality type handles the rest.

## Verification

1. Run NPC cron locally at various PT hours, verify time-of-day matches
2. Check coast pulse feed shows full post text (up to 3 lines)
3. Confirm no "pre-dawn" posts appear during afternoon/evening hours
