# Password Reset Implementation

This document outlines the complete password reset flow implementation for the Quiver app using Supabase authentication with Next.js App Router.

## 🔄 Flow Overview

1. **User initiates reset**: Visits `/auth/forgot-password` and enters email
2. **Email sent**: Supabase sends email with reset link pointing to `/auth/confirm`
3. **Token verification**: `/auth/confirm` server route verifies token and sets session
4. **Password reset**: User redirected to `/auth/reset` with valid session
5. **Password update**: User enters new password, remains authenticated, redirected to app

## 📁 Implementation Files

### A. Supabase Utilities

**`utils/supabase/client.ts`**
```typescript
// Browser client with PKCE flow for client-side operations
export const createClient = () => createBrowserClient(url, key, { 
  auth: { flowType: 'pkce' }
});
```

**`utils/supabase/server.ts`**
```typescript  
// Server client with Next.js cookies integration for SSR
export const createClient = () => createServerClient(url, key, { 
  cookies: { get, set, remove }
});
```

### B. Server Route

**`app/auth/confirm/route.ts`**
- Handles GET requests with `token_hash`, `type`, and `next` parameters
- Verifies OTP token using `supabase.auth.verifyOtp()`
- Redirects to `/auth/reset` on success, `/error` on failure
- Sets session cookies automatically via Supabase

### C. Reset Page

**`app/auth/reset/page.tsx`**
- Client component with session validation
- Form with password (8+ chars) and confirm password fields
- Uses `supabase.auth.updateUser({ password })` for password update
- Redirects to configurable destination (POST_RESET_DEST = "/")
- Preserves authentication after password change

### D. Error Handling

**`app/error/page.tsx`**
- Handles invalid/expired links with specific error messages
- Provides clear navigation back to forgot password or sign in
- Responsive design with proper error states

### E. Updated Flow

**`app/auth/forgot-password/page.tsx`** 
- Updated to use new redirect URL: `/auth/confirm?next=/auth/reset`
- Uses new Supabase utility: `import { createClient } from "@/utils/supabase/client"`

## 🔧 Configuration

### Supabase Dashboard Setup

1. **Authentication → Redirect URLs**
   ```
   http://localhost:3000
   https://yourdomain.com
   ```

2. **Authentication → Email Templates → Reset Password**
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset
   ```

3. **Middleware Configuration**
   - `/auth/*` and `/error` routes are public (no authentication required)
   - Updated in `middleware.ts` to skip auth checks for these paths

## 🧪 Testing

### Playwright Tests

**`e2e/password-reset-flow.spec.ts`** - New comprehensive test suite:
- Complete password reset flow (mocked)
- Auth confirm route parameter validation  
- Error page message verification
- Form validation (password length, mismatch)
- Navigation link functionality

**`e2e/password-recovery.spec.ts`** - Updated existing tests:
- Updated to test `/auth/reset` instead of `/auth/update-password`
- Updated password length validation (8+ chars instead of 6+)
- Updated import paths for new Supabase utilities

### Test Commands
```bash
# Run specific reset flow tests
npx playwright test password-reset-flow.spec.ts

# Run all password-related tests  
npx playwright test password-recovery.spec.ts password-reset-flow.spec.ts
```

## 🎯 Key Features

### Security
- Server-side token verification with `verifyOtp()`
- Session validation before allowing password reset
- 8+ character password requirement
- Automatic session cleanup on invalid tokens

### User Experience
- Clear error messages for expired/invalid links
- Loading states during session verification
- Preserved authentication after password reset
- Responsive design with Tailwind CSS

### Developer Experience
- Configurable post-reset destination via `POST_RESET_DEST` constant
- Follows established architectural patterns (`useDataFetcher`, etc.)
- Comprehensive error handling and logging
- Type-safe implementation with TypeScript

## 🔄 Usage Examples

### Triggering Password Reset
```typescript
// In any component
const supabase = createClient();
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${baseUrl}/auth/confirm?next=/auth/reset`
});
```

### Email Template Configuration
The email template uses Supabase's built-in variables:
- `{{ .SiteURL }}` - Your configured site URL
- `{{ .TokenHash }}` - Secure token for verification  
- `{{ .Type }}` - Always "recovery" for password resets

### Customizing Redirect Destination
```typescript
// In app/auth/reset/page.tsx
const POST_RESET_DEST = "/dashboard"; // Change this to redirect elsewhere
```

## 🚀 Production Checklist

- [ ] Configure production Supabase redirect URLs
- [ ] Update email template with production domain
- [ ] Test complete flow in production environment
- [ ] Verify email delivery and formatting
- [ ] Monitor error rates and user feedback

## 📊 Architecture Compliance

✅ **Follows Established Patterns**:
- Uses `useDataFetcher` for client-side data fetching
- Server routes use centralized error handling  
- Components follow DRY principles
- TypeScript-first with explicit interfaces
- Real-time subscriptions with proper cleanup

✅ **Security Best Practices**:
- Server-side token verification
- No client-side token exposure
- Proper session management
- RLS policy compliance (inherits from Supabase auth)

✅ **Testing Standards**:
- Unit validation for form inputs
- Integration testing for complete flow
- E2E testing with Playwright
- Error case coverage

This implementation provides a robust, secure, and user-friendly password reset experience while maintaining consistency with the existing Quiver codebase architecture.