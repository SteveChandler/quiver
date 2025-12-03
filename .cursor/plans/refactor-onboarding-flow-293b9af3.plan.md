<!-- 293b9af3-85d0-437b-ba01-02c46515ef0d 4e5bf987-3f5c-461d-84ad-2250e85cfcd9 -->
# Refactor Onboarding Flow

## 1. Create Profile Context

Create a new `ProfileContext` to manage global profile state, satisfying the requirement for server-driven control flow and immediate updates.

- **File:** `context/profile-context.tsx` (New)
- **Features:**
- Uses `useAuth` to get the current user.
- Fetches profile data on mount/user change (reusing logic from `actions/profile-actions.ts` via a hook).
- Exposes `profile`, `isLoading`, `error`, and `updateProfile(newProfile)` to consumers.
- Ensures `updateProfile` updates the local state immediately.

## 2. Update Providers

Wrap the application with the new `ProfileProvider`.

- **File:** `components/providers.tsx`
- **Change:** Add `<ProfileProvider>` inside `<AuthProvider>`.

## 3. Refactor Onboarding Store

Decouple draft state and scope to user ID.

- **File:** `store/onboarding-store.ts`
- **Changes:**
- Add `userId: string | null` to `OnboardingState`.
- Remove `isCompleted` from the `persist` middleware whitelist (it can remain in state for runtime logic if needed, but not persisted).
- Add `checkUserId(currentUserId)` action: if stored `userId` !== `currentUserId`, call `reset()` and `setUserId`.
- Update `persist` options to include `userId` and exclude `isCompleted`.

## 4. Refactor Server Actions

Ensure atomic save and return updated data.

- **File:** `actions/onboarding-actions.ts`
- **Change:** Update `saveOnboardingData` to return `{ success: true, profile: updatedProfile }` instead of just success.

## 5. Update Onboarding Dialog

Implement the new visibility and save logic.

- **File:** `components/onboarding/onboarding-dialog.tsx`
- **Changes:**
- Remove `/api/user/onboarding-status` fetch.
- Use `useProfile` to get `profile` and `updateProfile`.
- Logic: Show if `!profile.onboarding_completed_at` AND `!localStorage.getItem('onboarding_dismissed')`.
- On Save: Call `saveOnboardingData`, then `updateProfile(result.profile)`.
- Use `useEffect` to call `store.checkUserId(user.id)` when user changes.

## 6. Cleanup

Remove obsolete code.

- **Delete:** `app/api/user/onboarding-status/route.ts` (and folder).

### To-dos

- [ ] Create context/profile-context.tsx
- [ ] Update components/providers.tsx to include ProfileProvider
- [ ] Refactor store/onboarding-store.ts for user scoping and draft separation
- [ ] Update actions/onboarding-actions.ts to return profile
- [ ] Update components/onboarding/onboarding-dialog.tsx to use new context and logic
- [ ] Delete app/api/user/onboarding-status