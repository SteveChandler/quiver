## Quiver App: Session & Beach Features Action Plan

### 1. Remove Photo Upload from “Plan Session”

**Why:** Photos shouldn’t be attached until after a session is completed.

**How:**

```tsx
// In app/plan-session/page.tsx and SessionForm.tsx
{mode === 'logged' && <SessionPhotoUpload />}
```

1. Remove or conditionally hide `<SessionPhotoUpload>` when `mode === 'plan'`.
2. Update schema/UI so only `type === 'logged'` renders the photo step.

---

### 2. Convert a Saved Plan into a Logged Session

**Why:** Let users plan ahead, then mark sessions as completed to attach photos and ratings.

**How:**

1. **Database:**
   - Add or ensure `sessions.type` column (`planned` | `logged`).
2. **Server Action:**
   ```ts
   export const updateSession = withAuthenticatedAction(
     async ({ id, type, actualTime, ratings, photos }) => {
       // update logic
     }
   );
   ```
3. **UI:**
   - On "Upcoming Sessions" list, show **Mark as Completed** button for planned sessions.
   - Button opens Log-Session form prefilled with plan data.
4. **Permissions:**
   - RLS policy: only owner can update their sessions.

---

### 3. Map-Based Custom Beach Saving

**Why:** Let users add their own surf spots anywhere, privately.

**How:**

1. **Database Options:**
   - **Option A:** Add `owner_id` and `is_private` boolean to `beaches`.
   - **Option B:** Create new `user_beaches` table with owner linkage.
2. **RLS Policy:**
   ```sql
   CREATE POLICY select_private_beaches
   ON beaches FOR SELECT USING (
     is_private = false OR owner_id = auth.uid()
   );
   ```
3. **UI:**
   - In `beach-search.tsx`, add **+ Add My Spot** button.
   - Open map widget; on click capture `lat/lng`.
   - Prompt for name; save via server action.
4. **Forecast integration:**
   - Reuse `forecastService.getForecast(lat, lng)` for custom spots.

---

### 4. Fetch & Display Forecast for Custom Spots

**Why:** Provide accurate, location-based surf forecasts for user-added beaches.

**How:**

1. In new `BeachDetail` component for custom beaches, call the same server action as public forecasts.
2. Show a fallback banner if using nearest buoy data.
3. Cache per-user forecasts in `enhanced_forecasts` keyed by beach ID.

---

### 5. Private-by-Default: User-Saved Spots

**Why:** Only creators should see and manage their custom beaches.

**How:**

- Implement RLS so only `owner_id = auth.uid()` sees `is_private` beaches.
- Filter out private beaches in all public listings.

---

## Next Steps & Priorities

1. **Immediate:**
   - Remove photo upload from plan form.
   - Add "Mark as Completed" button & implement session type update.
2. **Short-term:**
   - Extend `beaches` schema & RLS rules.
   - Build map picker UI & save custom beaches.
3. **Medium:**
   - Wire up forecast fetching & fallback notices.
   - End-to-end tests: plan → complete → log → photo → view.

