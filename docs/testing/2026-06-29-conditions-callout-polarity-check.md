# Conditions callout — live arrow-polarity check (Task 6)

The callout's banner-arrows are placed by `travelScreenAngleDeg(bearing) = bearing + 90`
(`components/map/conditions-callout.ts`). The math is unit-tested, but the **on-screen
direction must be confirmed against the running app** — the same kind of check the
wind-particle reversal bug needed. This is the one step that can't be a unit test.

## What you're verifying

For a tapped beach, each arrowhead must point in the swell's **travel** direction
(`bearing + 180`, i.e. toward/through the beach), and must **agree with the swell-field
particle drift** for that same component. If an arrowhead points opposite the particles,
polarity is reversed.

## Run it

1. **Serve the embed** (same clean server used for the plan-024 wind/S1 captures):
   ```bash
   cd /Users/stevenchandler/Desktop/dev/quiver/.worktrees/024-webview-ios-readiness-20260628
   yarn build && PORT=3011 yarn start    # serves http://127.0.0.1:3011/embed/map
   ```

2. **Run the iOS WebView app** pointed at that embed (per the `maestro-native` skill /
   the existing `/tmp/quiver-plan-024/` setup). Open the Explore WebView map.

3. **Tap open water** near a beach with a current forecast (e.g. Del Mar). A callout
   should pin to the nearest beach with S1 / (S2) / wind banner-arrows.

4. **Capture a frame** to:
   `quiver-native/.worktrees/024-webview-ios-readiness-20260628/docs/release/evidence/plan-024-webview-ios-rollout/ios-webview-conditions-callout.png`

## Judge polarity against ground truth

Get the captured beach's real bearings (substitute the name). Supabase MCP / SQL on
project `vawdnbbgawichorsjiwe`:

```sql
SELECT b.name,
       COALESCE(f.swell_direction_om, f.wave_direction_om) AS s1_from_deg,
       f.swell_2_direction AS s2_from_deg,
       f.wind_direction_deg AS wind_from_deg
FROM beaches b
JOIN LATERAL (
  SELECT * FROM enhanced_forecasts
  WHERE beach_id = b.id AND forecast_at >= now() - interval '6 hours'
  ORDER BY forecast_at LIMIT 1
) f ON true
WHERE b.name = 'Del Mar';
```

For each component: `from_deg` is the compass bearing the energy COMES FROM. The
**arrowhead should point toward `from_deg + 180`** (travel). Quick screen sense:
swell from the W (~270°) → arrowhead points E (toward shore/right); swell from the
S (~180°) → arrowhead points N (up). The banner's dark name-pill sits on the
**source** side; the arrowhead is on the **beach** side.

**Cross-check:** the arrowhead and the swell-field particles for that layer must drift
the SAME way. They share the geo→vector convention, so disagreement = a real bug.

## If reversed

Flip the single source of truth — `travelScreenAngleDeg` in
`components/map/conditions-callout.ts` (use `bearing - 90`, or `bearing + 270`) — and
re-capture. Do NOT adjust per-banner. Re-run the builder unit test after.

## Record

Append a one-line "Conditions callout — polarity verified (date, device)" to
`quiver-native/.worktrees/024-webview-ios-readiness-20260628/docs/testing/webview-map-ios-rollout.md`
and commit the evidence PNG.
