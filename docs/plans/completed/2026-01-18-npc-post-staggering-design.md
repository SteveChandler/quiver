# NPC Post Staggering Design

**Date:** 2026-01-18
**Status:** Draft
**Author:** Steven Chandler + Claude

## Problem

NPC intel posts all appear at the exact top of each hour (e.g., all 5 posts at 6:00:00 AM). This breaks the illusion of organic community activity.

## Current Architecture

The `/api/cron/npc-activity` cron job:
- Runs hourly from 5am-8pm PT
- Selects NPCs based on personality and posting windows
- Creates up to 10 posts per run
- All posts in a batch share `created_at = now`

The hourly distribution is already built in. The issue is within-hour clustering.

## Solution

Add jittered timestamps with burst grouping so posts within each hourly cron run appear naturally spread across the hour.

### Burst Pattern

Posts are grouped into natural bursts rather than randomly scattered:

| Aspect | Value |
|--------|-------|
| Burst size | 2-3 posts |
| Within-burst spacing | 2-8 minutes apart |
| Between-burst gap | ~15-25 minutes |
| Hour coverage | Minutes 5-55 (leaving buffer) |

**Example - 5 posts at 6:00 AM base time:**
```
6:07, 6:11       (burst 1)
6:29, 6:33, 6:38 (burst 2)
```

## Implementation

### Changes Required

**File:** `/app/api/cron/npc-activity/route.ts`

1. Add `generateJitteredTimestamps()` function
2. Update the NPC processing loop to use indexed timestamps

### New Function

```typescript
function generateJitteredTimestamps(count: number, baseTime: Date): Date[] {
  if (count === 0) return [];
  if (count === 1) {
    // Single post: random offset 5-50 min into the hour
    const offset = 5 + Math.floor(Math.random() * 45);
    return [new Date(baseTime.getTime() + offset * 60 * 1000)];
  }

  // Group into bursts of 2-3
  const bursts: number[][] = [];
  let remaining = count;
  while (remaining > 0) {
    const burstSize = remaining >= 4 ? (Math.random() < 0.5 ? 2 : 3) : remaining;
    bursts.push(Array(burstSize).fill(0));
    remaining -= burstSize;
  }

  // Space bursts across 50 minutes (5-55 min mark)
  const burstAnchors = bursts.map((_, i) =>
    5 + Math.floor((i + Math.random()) * (50 / bursts.length))
  );

  // Assign timestamps within each burst (2-8 min apart)
  const timestamps: Date[] = [];
  bursts.forEach((burst, burstIdx) => {
    let offset = burstAnchors[burstIdx];
    burst.forEach(() => {
      timestamps.push(new Date(baseTime.getTime() + offset * 60 * 1000));
      offset += 2 + Math.floor(Math.random() * 6); // 2-8 min gap
    });
  });

  return timestamps;
}
```

### Loop Update

```typescript
// Before processing NPCs
const postTimestamps = generateJitteredTimestamps(npcsToProcess.length, now);

// In the loop (line ~88)
for (let i = 0; i < npcsToProcess.length; i++) {
  const npc = npcsToProcess[i];
  const timestamp = postTimestamps[i];
  // ... rest of processing uses timestamp instead of now
}
```

## No Changes Required

- Database schema (`created_at` column already exists)
- NPC selection logic (`selectNPCsForCurrentHour`)
- Template hydration
- Other cron jobs (`daily-intel`, `morning-forecast-bot`)

## Testing

1. Run cron manually, verify posts have different `created_at` values
2. Confirm timestamps fall within 5-55 minute range of the hour
3. Verify burst grouping (posts in pairs/triples close together)

## Rollout

1. Deploy to staging
2. Trigger cron manually, inspect database
3. Deploy to production
4. Monitor next few hourly runs
