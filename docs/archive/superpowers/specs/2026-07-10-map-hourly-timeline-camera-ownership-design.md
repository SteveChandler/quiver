# Map Hourly Timeline and Camera Ownership Design

**Date:** 2026-07-10

**Status:** Approved

**Surfaces:** Public `/map`, shared `InteractiveMap`, `/embed/map`, bulk forecast API

## Problem

The public map currently exposes forecast time as relative, irregular offsets such as `+3h`, `+6h`, and `+12h`. A surfer must know the current time and do arithmetic to understand the forecast. The map also samples only a fixed 42-hour window even when later forecast rows exist.

The map camera has a separate ownership bug. Home beach, last-viewed location, GPS, and the San Diego fallback are treated as continuously authoritative rather than initial defaults. During manual exploration, a marker click or map-click side effect can clear the selected beach. `MapContent` then derives `initialCenter` from `userLocation`, and `InteractiveMap` actively flies back to that location. This reproduces the reported Hawaii flow: select Hawaii, pan to Waikiki, select Ala Moana Bowls, then snap back toward San Diego.

## Goals

1. Present forecast time with a Windy-style, full-width timeline that is readable without arithmetic.
2. Provide one selectable frame per forecast hour.
3. Display time in the viewed location's timezone.
4. Continue through every contiguous hour the forecast service actually provides, without a product-defined 42-hour cutoff.
5. Keep initial location selection useful while ensuring manual exploration owns the camera afterward.
6. Preserve the existing swell-layer controls, conditions callout, native bridge, and reduced-motion behavior.

## Non-goals

- Reproducing Windy's visual design, premium markers, weather layers, or branding.
- Inventing forecast hours beyond stored data.
- Changing forecast model generation or retention.
- Persisting arbitrary map camera positions across sessions in this slice.
- Reworking clustering behavior outside the public map choices already shipped.

## Experience Design

### Timeline placement and structure

The public map gets a dedicated timeline fixed to the bottom edge of the map. It is visually separate from the cream legend, which continues to own layer selection and explanatory keys.

The timeline contains:

- a play/pause button at the leading edge;
- a horizontally scrollable or compressed sequence of day segments;
- an hour-resolution scrub track spanning those segments;
- a Quiver-orange time bubble anchored above the active position;
- clear day boundaries and labels such as `Fri 10`, `Sat 11`, and `Sun 12`.

The time bubble shows an exact local timestamp, for example `Fri 10 — 2 PM`. The initial live position may say `Now` in supporting copy, but it must still expose the actual clock time. After midnight, both the date and hour change together.

The timeline adopts Quiver's cream-paper, ink, orange, hard-border, and sticker-shadow language. It does not copy Windy's gray styling.

### Interaction

- Dragging the scrubber updates the map continuously, snapping the committed value to an hourly frame.
- Clicking or tapping a point on the track selects that hour.
- Keyboard arrow keys move one hour at a time.
- Page Up/Page Down move one day at a time.
- Home returns to the first loaded forecast hour; End moves to the last loaded hour.
- Play advances smoothly through the hourly frames while the timestamp and field remain synchronized.
- Reduced-motion mode advances discretely without interpolated visual motion.
- Reaching the end of loaded data requests the next chunk before playback or scrubbing stalls.
- When the service reports no later data, playback stops at the final real hour and the control communicates `Forecast ends <local timestamp>`.

### Responsive behavior

Desktop shows multiple labeled day segments at once. Mobile keeps the play control and time bubble visible while the day track scrolls beneath them. The timeline must not cover map attribution, active conditions callouts, or primary map controls. Safe-area insets are respected on iOS.

The interactive track has a minimum 44px touch target. The time bubble is clamped within the viewport so it cannot clip at either end.

## Time Semantics

### Location-local timezone

All labels represent the viewed surf location's civil time, not the device timezone.

Timezone priority:

1. selected beach timezone;
2. nearest valid loaded beach to the map center;
3. selected region's configured timezone when available;
4. device timezone only as a final fallback.

Changing the viewed region may relabel existing UTC frames, but it must not change the underlying forecast instant. Labels are generated from ISO timestamps with `Intl.DateTimeFormat` and an explicit IANA timezone.

Timezone abbreviations such as `HST` or `PDT` appear in the active time bubble when useful. Day segments are built from location-local calendar days, including daylight-saving transitions. Repeated or skipped local hours remain distinct internally by UTC timestamp.

### Hour boundaries

Forecast frames are keyed by their actual `forecast_at` timestamp. The interface does not calculate a label by adding an offset to the browser clock. The first frame is the nearest available forecast hour at or after the current instant; subsequent frames are ordered stored hours.

Missing hours are not filled by repeating the previous partition. A gap is represented as unavailable data and is skipped during playback, with a subdued gap treatment on the track.

## Forecast Horizon and Loading

### Data-driven horizon

The fixed `HOURLY_SWELL_TIMELINE_HOUR_OFFSETS` contract is replaced for the expandable timeline. The endpoint returns actual forecast timestamps and whether a later chunk exists.

The client initially requests 48 hours. It prefetches the next 48-hour chunk when the selected position enters the final six loaded hours or playback approaches that boundary. Chunks are appended and deduplicated by UTC timestamp. Requests are serialized per beach-set/window key so rapid scrubbing cannot corrupt order or issue duplicate paid/database work.

Loading stops only when:

- the endpoint returns no rows after the current end timestamp; or
- it explicitly returns `hasMore: false`.

This is not an unlimited database query. It is progressive access to the available forecast horizon, keeping initial map payload and render time bounded.

### API contract

`GET /api/forecasts/bulk` retains its current default response for existing consumers. Hourly timeline consumers use explicit pagination parameters:

```text
timeline=hourly
timelineStart=<ISO timestamp, inclusive>
timelineHours=48
```

The hourly response adds a shared timeline envelope:

```ts
type HourlySwellTimeline = {
  timestamps: string[];
  partitionsByBeach: Record<string, Array<SwellPartition | null>>;
  hasMore: boolean;
  nextStart: string | null;
};
```

Rules:

- `timestamps` are unique, ascending UTC ISO hours.
- Every beach array aligns by index with `timestamps`.
- `null` means that beach has no real row for that hour.
- `nextStart` is strictly later than the final returned timestamp.
- `timelineHours` is bounded server-side to a safe maximum per request.
- Existing `swellPartitionTimeline` remains during migration for legacy callers, then may be removed in a separate cleanup after all consumers move.

The query window must use `forecast_at`. It must not derive timeline coverage from `forecast_date` and `forecast_time`.

### Client state

A timeline controller owns:

- ordered UTC timestamps;
- aligned partition frames by beach;
- active timestamp/index;
- playback state;
- loading, exhausted, and error states;
- the active IANA timezone;
- in-flight chunk identity and deduplication.

The controller exposes absolute timestamps to the presentation component and the swell-field renderer. It does not expose display labels as source-of-truth state.

The public map uses expandable hourly mode by default. `/embed/map` retains compatibility with native bridge commands that address an index, while bridge events additionally include the active ISO timestamp. Legacy non-hourly query behavior remains supported until native clients migrate.

### Failure handling

- If a later chunk fails, already loaded hours remain usable.
- Playback pauses at the loaded boundary and offers retry.
- The map and current conditions do not enter an error state solely because timeline extension failed.
- Stale or out-of-order chunk responses are ignored using a request/window generation key.
- Changing the beach set or region resets extension state to the new data scope while preserving the nearest equivalent active UTC instant when possible.

## Camera Ownership

### Ownership model

Camera state distinguishes defaults from commands and user exploration:

```ts
type CameraOwner = "initial" | "explicit-command" | "user";

type CameraCommand = {
  id: number;
  center?: { lat: number; lon: number };
  bounds?: [[number, number], [number, number]];
  source: "home" | "last-viewed" | "gps" | "fallback" | "region" | "search" | "pin";
};
```

Home beach, last-viewed beach, GPS, and fallback may issue the initial command once. They do not continuously own the camera.

The following transfer ownership away from initial location:

- selecting a region;
- selecting a search result;
- selecting a beach pin;
- dragging, zooming, rotating, or otherwise moving the map through a user-originated gesture.

After that transfer, later GPS resolution, GPS polling, profile hydration, beach-list reloads, and selection cleanup cannot issue a camera move.

Only an explicit action such as `Use Near Me`, a new region choice, or a new search/pin choice may issue another camera command. Commands are applied by changing `CameraCommand.id`, not by observing incidental changes to a derived `initialCenter` prop.

### Marker and map-click behavior

A marker activation and the synthetic Mapbox map click it may generate are one interaction. Generic map-click handling must ignore events whose original target is inside a beach marker or conditions callout.

Clearing a selected marker or dismissing a callout never resets camera ownership and never falls back to GPS. The selected beach is presentation state; it is not the sole guard preventing recentering.

### Region framing

Regions with configured bounds use `fitBounds` with responsive padding. Regions without bounds derive bounds from their loaded, valid beach coordinates. A single hard-coded center is used only when fewer than two valid coordinates exist.

Selecting Hawaii therefore frames the available Hawaii beach set rather than landing on a North Shore-biased point. Once the user pans to Waikiki, that camera remains under user control.

## Component Boundaries

### New or extracted units

- `components/map/swell-timeline-controller.ts` or an equivalent hook: absolute-time state, chunk loading, append/dedupe, playback boundary behavior.
- `components/map/swell-field/swell-day-timeline.tsx`: Windy-style day track and active time bubble.
- Timeline formatting utilities: timezone-aware day segmentation and labels, pure and unit tested.
- Camera command/ownership utilities: pure reducer or state transition helper, unit tested independently from Mapbox.

### Existing units changed

- `MapView`: creates explicit camera commands and chooses the viewed timezone context.
- `MapContent`: passes camera commands rather than continuously derived center authority.
- `InteractiveMap`: applies new command IDs, reports genuine user gestures, ignores marker-originated generic clicks, and consumes absolute timeline frames.
- `map-beach-loader`: requests timeline chunks and preserves aligned timestamps.
- `/api/forecasts/bulk`: paginated hourly timeline envelope and real-data exhaustion metadata.
- `/embed/map`: bridge compatibility for index commands plus absolute timestamp events.

Shared clustering remains intact. No migration is expected.

## Accessibility

- The timeline is exposed as a labeled slider with `aria-valuetext` equal to the full location-local timestamp and timezone.
- Play/pause has a stable accessible name reflecting its next action.
- Day boundaries are not separate tab stops.
- Keyboard controls follow the interaction rules above.
- Focus indicators meet Quiver contrast requirements.
- Screen readers are notified when more hours load, when the forecast horizon ends, and when extension fails.
- Motion respects `prefers-reduced-motion` without reducing access to any hour.

## Analytics

Reuse `map_interaction` with bounded metadata:

- `action: "timeline_scrub" | "timeline_play" | "timeline_pause" | "timeline_extend"`;
- active UTC timestamp;
- active location-local hour and timezone;
- loaded horizon hours;
- extension result.

Camera interaction events distinguish `camera_source` (`gps`, `region`, `search`, `pin`, `pan`, `zoom`) so recenter regressions can be diagnosed. Do not emit an event for every playback tick.

## Testing

### Unit tests

- Hourly labels in Hawaii, Pacific, and a daylight-saving timezone.
- Day segmentation across midnight and DST transitions.
- Chunk append, timestamp deduplication, out-of-order response rejection, and exhaustion.
- Missing beach frames remain `null` rather than carrying forward stale data.
- Keyboard increments by hour/day and clamps at real boundaries.
- Camera reducer transitions from initial to user ownership and rejects later GPS recenter attempts.
- Explicit `Use Near Me`, region, search, and pin commands can move the camera after manual exploration.
- Marker-originated map clicks do not clear ownership or issue a fallback command.

### API tests

- `timelineStart` and `timelineHours` query `forecast_at` in the expected inclusive/exclusive window.
- Shared timestamps are sorted and aligned across beaches.
- `hasMore` and `nextStart` are correct at partial, full, and exhausted chunks.
- Existing non-hourly consumers retain their response contract.
- Server-side limits reject or clamp abusive window sizes.

### E2E tests

- Public map shows absolute location-local time rather than `+3h`.
- Scrubbing advances one hour and updates the field and time bubble together.
- Crossing midnight changes the day segment and timestamp.
- Approaching the loaded boundary appends later day segments without resetting the active hour.
- Selecting Hawaii frames Hawaii beaches.
- Pan from the initial Hawaii frame to Waikiki, select Ala Moana Bowls, and verify the camera remains in Hawaii.
- A delayed or changed GPS result after manual exploration does not recenter to San Diego.
- `Use Near Me` explicitly returns the camera to the mocked GPS location.
- Mobile timeline has no horizontal viewport overflow, clipped bubble, or obscured callout.

## Rollout and Compatibility

1. Land the API envelope and pure formatting/controller tests while retaining legacy fields.
2. Move the public map to expandable hourly mode and the new timeline.
3. Land camera ownership and Hawaii regression coverage in the same release so timeline interaction cannot trigger recentering.
4. Extend the embed bridge with timestamps while retaining index compatibility.
5. Observe payload size, API latency, extension failures, and camera-source analytics before removing legacy timeline code.

No database migration or environment variable is required. Production release follows the normal web release gate; native bridge field additions are backward compatible.

## Acceptance Criteria

- No public map label uses relative offsets such as `+3h`.
- Every real stored forecast hour in the loaded horizon is individually selectable.
- The timeline continues loading until the API reports no later data.
- The active label reflects the viewed location's local date, hour, and timezone.
- Forecast gaps are never represented by duplicated stale frames.
- Hawaii region selection frames Hawaii beach coverage rather than a North Shore point.
- Selecting Ala Moana Bowls cannot cause a fly-to San Diego.
- GPS/default recentering occurs only during initial resolution or after an explicit location command.
- Timeline, map, callout, and native bridge tests pass on desktop and mobile.
