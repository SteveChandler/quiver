## Debug Plan: “Best Window (Passed 6:00 AM – 6:00 AM)” Issue

### 1. Reproduce Deterministically
- Fix target beach and date.  
- Disable client cache: `?nocache=1`.  
- Hit server route powering this card and save raw JSON.  
- Re-run with `at=2025-10-21T15:13:00-07:00` using a time override flag.

### 2. Capture Inputs
- Log and persist all upstream inputs: hourly surf (Hs/Tp/dir), wind (spd/dir), tide (ft), sunrise/sunset, and beach prefs.  
- Include source timestamps and station IDs.

### 3. Verify Time Handling
- Print all times in UTC and local TZ.  
- Check DST offsets and “day start” boundaries.  
- Confirm scoring loop and renderer use the same TZ.  
- Diff NOAA tide events vs your series after conversion.

### 4. Score Trace
Add an hourly trace dump:
```text
hour_local, score_total, score_breakdown {tide, wind, swell, crowd?}, tide_ft, wind_kt, swell_dir_deg, flags {outside_tide, onshore, too_small,...}
```
Persist to a debug table or JSON log. This exposes if every hour scored ≤ 0.

### 5. Window Selection Logic
- Inspect reducer that turns hourly scores into windows.  
- Check for:
  - `>= threshold` vs `>` off-by-one.  
  - Minimum window length collapsing to one tick.  
  - Rounding to nearest tide event giving identical start/end.  
  - Fallback rendering of “No good window today” instead of `6:00 AM–6:00 AM`.

### 6. Preference Constraints
- Confirm beach preference bounds (`preferred_tide_ft_min/max`) are numeric and within units.  
- Test with wide bounds—if window appears, tide constraint too strict.

### 7. Staleness and Caching
- Trace `Updated at` source: compute time vs render time.  
- Verify ISR/revalidation, Redis keys, and per-beach cache TTLs.  
- Cache key must include `beach_id + date + model_run_time`.  
- Ensure background jobs didn’t write partial forecasts.

### 8. UI Guardrails
- In component, if `start === end` or window < 30 min, render “No optimal window.”  
- Ensure “Passed” badge uses consistent TZ comparison (`now > window_end`).

### 9. Instrumentation
- Add `X-Debug-Forecast: true` header to return score trace.  
- Log warnings for zero-length windows or missing inputs.

### 10. Targeted Tests
- **Unit:** synthetic series → no window, 1 hr, multi-hr; assert `start < end`.  
- **Unit:** DST boundary dates.  
- **Integration:** tide = 4.8 ft, preferred = 0–4 ft → expect “No window.”  
- **Snapshot:** ensure “Medium” label matches numeric confidence.

### 11. Likely Fixes
- Adjust threshold/min-length logic in reducer.  
- Widen tide tolerance.  
- Normalize timezones in scorer and presenter.  
- Regenerate cache using model timestamp.

### 12. Rollout
- Feature-flag corrected reducer.  
- Enable debug trace for 1 week on 10 popular beaches.  
- Add Sentry issues for `zero_length_window` and `stale_payload_mismatch`.

