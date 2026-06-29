# WebView Map Reuse Design

Approved: 2026-06-28

## Goal

Make Explore feel like a fast, data-heavy surf map while keeping Quiver native controls and flows native. The map should approach the interaction quality of Windy: quick pan and zoom, inspectable layers, stable focus, clear marker state, and no unnecessary UI between the surfer and the data.

## Product Role

Explore becomes the primary surf intelligence surface:

- Pan and zoom across surf regions.
- Inspect spot conditions from markers and clusters.
- Scrub forecast time and switch swell layers.
- Place custom spots directly on the map.
- Hand off save, log, detail, auth, and navigation actions to native UI.

## Ownership Split

The WebView owns the map canvas:

- Mapbox GL rendering.
- Swell field particles.
- Spot markers and clusters.
- Tap hit-testing.
- Viewport state.
- Custom spot placement pin movement.

Native owns the application chrome:

- Zine controls and filters.
- Bottom sheets.
- Save, log, and detail actions.
- Add Spot form and Supabase writes.
- Haptics.
- Permissions.
- Navigation.
- Auth state and feature gating.

The web embed must not render the full web `/map` toolbar. Native sends commands; the embed renders the data map.

## Explore Layout

Native Explore uses a full-bleed WebView beneath native chrome. Chrome should be compact and zine-aligned: cream paper controls on the twilight stage, restrained shadows, readable labels, and no marketing copy.

Expected native overlays:

- Top search/filter row.
- Layer and time controls.
- Compact map status chips.
- Bottom surf spot sheet.
- Placement confirm/cancel controls.

## Custom Spot Placement

Custom spot placement happens inside the WebView map.

Flow:

1. Native user taps add spot.
2. Native sends `startPlacement`.
3. WebView drops a placement pin at the provided coordinate or current map center.
4. User taps or drags within the map to move the pin.
5. WebView emits `placementChanged` with `lat` and `lon`.
6. Native confirm sends `confirmPlacement`.
7. WebView emits `placementConfirmed`.
8. Native opens the native Add Spot sheet with those coordinates.
9. Save remains a native Supabase flow.

This keeps precise map hit-testing inside Mapbox while keeping the actual form native.

## Spot And Cluster Interaction

Marker tap:

- WebView emits `spotSelected`.
- Native opens the zine bottom sheet with Save, Log, View Details, and forecast summary.

Cluster tap:

- WebView zooms or expands the cluster internally.
- Native sheet does not open for cluster taps in the initial production slice.

Map tap outside placement:

- WebView may emit `mapTapped` for future analytics, but native does not need to respond in the initial slice.

## Layers And Time

Native controls layer/time state; WebView renders it.

Initial layers:

- Combined surf quality field.
- Primary swell.
- Secondary swell.
- Wind.
- Spot markers and clusters.

Native commands:

- `setLayer`
- `setForecastTime`

WebView events:

- `renderHealth`
- `viewportChanged`
- `ready`
- `loadFailed`

## Beach Detail Hero

Beach Detail swell hero remains non-interactive for now.

It should visually match the Explore map field style, but it must not support pan, zoom, tap, marker selection, cluster expansion, or placement. The implementation may use a locked embed mode or the current native hero updated to match. It must not become a second interactive map surface.

## Visual Direction

The map should borrow Windy's data density lesson without copying Windy's brand:

- Dark twilight ocean and coast base.
- Readable roads/coast labels.
- Animated swell vectors or particles.
- Warm condition markers.
- No decorative clutter.
- Native zine chrome layered above the map.

Data readability wins over decoration.

## Performance Contract

Targets:

- Pan and zoom remain responsive during swell animation.
- Marker rendering avoids heavy per-marker React DOM where scale requires map layers.
- Viewport and placement events are throttled.
- Native data commands are idempotent.
- The current native map remains fallback until device QA passes.

Gate:

- iOS simulator visual QA.
- Real mid-Android WebView QA.
- 2-minute pan/zoom/layer/time session.
- Sustained p10 FPS at or above 30.
- No blank tiles.
- No stuck placement pin.
- No bottom-sheet event lag.

## Bridge Contract

WebView events:

- `ready`
- `loadFailed`
- `viewportChanged`
- `spotSelected`
- `clusterSelected`
- `mapTapped`
- `placementStarted`
- `placementChanged`
- `placementConfirmed`
- `placementCancelled`
- `renderHealth`

Native commands:

- `setViewport`
- `setLayer`
- `setForecastTime`
- `setSelectedSpot`
- `startPlacement`
- `cancelPlacement`
- `confirmPlacement`
- `setTheme`
- `setReducedMotion`

All messages are JSON objects with a top-level `type` string and `payload` object. Coordinates use `lat` and `lon`.

## Rollout

Ship behind a native feature flag.

### iOS rollout policy (2026-06-28)

iOS is the rollout target for the next validation pass. Android hardware QA remains useful
for broad confidence, but it is not a blocker for an iOS-only staged rollout decision.

Because `react-native-webview` is a native module, the WebView Explore map must not ship as a
same-runtime OTA update to an older production binary. The feature must remain disabled for the
current production runtime unless the installed iOS binary/runtime already includes
`react-native-webview` and the WebView map code. Otherwise ship a new iOS binary/runtime first,
then enable `EXPO_PUBLIC_WEBVIEW_EXPLORE_MAP_ENABLED=true` only for that runtime.

Required iOS checks before enabling the flag for a staged cohort:

- Flag off: Explore renders the existing native map path.
- Flag on: Explore renders `/embed/map` inside the native WebView with native layer/time controls.
- WebView failure fallback: web server down, WebView error, HTTP error, bridge `loadFailed`, or
  ready timeout demotes to the existing native map instead of leaving users on "Loading map."
- Bridge trust: messages and top-frame navigation are accepted only from the configured Quiver
  origin and `/embed/map` path.
- UX path: Wind layer, `+3h`, spot selection, and custom spot placement hand off to native UI.

Native runbook: `quiver-native/docs/testing/webview-map-ios-rollout.md`.

Phase 1:

- `/embed/map` route.
- Typed bridge schema.
- Native WebView wrapper.
- Spot selection.
- Clusters.
- Layer and time commands.
- Custom spot placement inside WebView.

Phase 2:

- Visual tuning.
- Performance telemetry.
- Device QA.

Phase 3:

- Decide whether Beach Detail hero uses locked WebView embed or matched native rendering.

## WebView Limits And Mitigations

- Android WebView GPU throughput is device-dependent. Mitigation: the native map stays
  default until the real mid-tier Android gate passes.
- WebView readiness can fail on WebGL, route, token, HTTP, or network problems.
  Mitigation: native has bridge failure, HTTP error, WebView error, and ready-timeout
  fallback to the existing native map.
- Bridge trust is a security boundary. Mitigation: native accepts top-frame navigation
  and bridge messages only from the configured Quiver origin and `/embed/map` path.
- WebView FPS alone is not full app smoothness. Mitigation: the Android gate requires
  WebView `renderHealth`, native first-usable-paint telemetry, Android `gfxinfo`, and
  manual UX checks.
- Custom spot placement must not split hit-testing between native and web. Mitigation:
  Mapbox/WebView owns tap and drag placement; native saves only the confirmed `lat` and
  `lon`.

Fallback if the gate fails: keep the existing native map as default, reduce the WebView
rendering workload behind the flag, or move the Explore map to a native Mapbox/RNMapbox
implementation.

## Implementation Order

1. Add `/embed/map`.
2. Add typed bridge message schema.
3. Build native WebView wrapper behind a feature flag.
4. Wire spot selection to native bottom sheet.
5. Wire layer/time commands.
6. Wire custom spot placement inside WebView.
7. Match Beach Detail hero visually, non-interactive.
8. Run device QA and decide replacement.

## Research Notes

The last30days pass found that Windy-style maps win by making dense data inspectable, and that power users punish extra taps or focus shifts in heavy map workflows. The implementation should preserve map focus during placement and layer switching. Mapbox's own performance guidance also points to sources, layers, and vertex count as primary costs, so marker and field rendering must stay render-path conscious from the first slice.

## Implementation Evidence

Status: code spike complete on 2026-06-28.

Built:

- `/embed/map` route with typed bridge messages.
- Native WebView Explore wrapper behind `EXPO_PUBLIC_WEBVIEW_EXPLORE_MAP_ENABLED`.
- Native layer/time controls using `setLayer` and `setForecastTime`.
- Custom spot placement inside the WebView map with native AddSpot sheet handoff.
- WebView error, HTTP error, bridge failure, and ready-timeout fallback to the existing native map.
- Origin/path validation for WebView navigation and bridge messages.
- Embed `renderHealth` FPS samples and native `webview_map_ready` first-usable-paint telemetry.
- Native Android gate script with hard PASS/FAIL output from `gfxinfo`, WebView FPS,
  first usable paint, and manual UX confirmation.

Verified:

- Web typecheck, full unit suite, production build, scoped ESLint, and diff check passed.
- Native typecheck, focused WebView tests, full Jest suite, and diff check passed.
- iOS simulator positive path passed: map rendered, Wind layer and `+3h` time control worked, placement opened AddSpot with approximate coordinates.
- iOS simulator fallback path passed: with the web server down, Explore rendered the existing native map instead of sticking on WebView loading.
- Android hardware QA was operator-verified on 2026-06-28 and looked good. The numeric gate artifact was not retained.

Rollout note:

- GO for staged feature-flagged productionization.
- Native gate runbook/script remains in place: `quiver-native/docs/testing/webview-map-android-gate.md`
  and `npm run qa:webview-map:android`.
- Capture the numeric Android gate artifact on the next device pass before broad/default-on rollout.
