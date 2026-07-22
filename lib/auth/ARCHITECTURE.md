# Authentication Library Architecture

## 🎯 **PURPOSE**

The `/lib/auth` directory provides server-side authentication utilities and wrappers for administrative access control, implementing role-based authentication patterns with Supabase integration.

## 📁 **DIRECTORY STRUCTURE**

```
lib/auth/
├── admin.ts           # Core admin authentication logic
└── admin-wrapper.ts   # Authentication wrappers for API routes and server actions
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Administrative Authentication Pattern**

```typescript
AdminAuthentication
├── Core Logic (admin.ts)
│   ├── User Retrieval (getCurrentUser)
│   ├── Role Validation (isAdmin)
│   └── Access Control (requireAdmin)
└── Wrapper Functions (admin-wrapper.ts)
    ├── API Route Wrappers (withAdminAuth)
    ├── Server Action Wrappers (withAdminServerAction)
    ├── Route Guards (adminRouteGuard)
    └── Client Helpers (checkAdminStatus, isAdminRequest)
```

### **Authentication Flow Architecture**

```typescript
AuthenticationFlow
├── Session Retrieval → Role Check → Access Grant/Deny
├── Error Handling → Appropriate HTTP Status Codes
└── Security Context → User Metadata Validation
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **admin.ts** (Core Authentication Logic)

- **Purpose**: Provides fundamental admin authentication functions
- **Features**:
  - User session retrieval from Supabase
  - Admin role validation across multiple metadata sources
  - Centralized access control logic
  - Type-safe user interfaces

**Core Functions:**

```typescript
// User retrieval with error handling
export async function getCurrentUser(): Promise<AdminUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user as AdminUser;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// Server-controlled admin role validation
export function isAdmin(user: AdminUser | null): boolean {
  if (!user) return false;

  if (ADMIN_USER_IDS.includes(user.id)) return true;

  return (
    user.app_metadata?.is_admin === true || user.app_metadata?.role === "admin"
  );
}

// Access control with proper error responses
export async function requireAdmin(): Promise<
  { user: AdminUser; error?: never } | { user?: never; error: string }
> {
  const user = await getCurrentUser();

  if (!user) return { error: "Authentication required" };
  if (!isAdmin(user)) return { error: "Admin access required" };

  return { user };
}
```

**AdminUser Interface:**

```typescript
export interface AdminUser extends User {
  app_metadata?: {
    role?: string;
    is_admin?: boolean;
  };
}
```

### **admin-wrapper.ts** (Authentication Wrappers)

- **Purpose**: Provides convenient wrappers for protecting routes and actions
- **Features**:
  - API route protection with automatic error responses
  - Server action authentication wrappers
  - Route guard middleware for pages
  - Client-side admin status checking

**API Route Wrapper:**

```typescript
export async function withAdminAuth<T>(
  handler: (user: any) => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: string }>> {
  try {
    const authResult = await authenticateAdmin();

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    return await handler(authResult.user);
  } catch (error) {
    console.error("Admin auth wrapper error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Server Action Wrapper:**

```typescript
export async function withAdminServerAction<T extends any[], R>(
  action: (user: any, ...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    const result = await requireAdmin();

    if (result.error) {
      throw new Error(result.error);
    }

    return action(result.user, ...args);
  };
}
```

**Route Guard Middleware:**

```typescript
export async function adminRouteGuard(
  request: NextRequest
): Promise<NextResponse | null> {
  try {
    const authResult = await authenticateAdmin();

    if (!authResult.success) {
      const signInUrl = new URL("/auth/sign-in", request.url);
      signInUrl.searchParams.set("message", "Admin access required");
      signInUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
      return NextResponse.redirect(signInUrl);
    }

    return null; // Allow access
  } catch (error) {
    console.error("Admin route guard error:", error);
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("message", "Authentication error");
    return NextResponse.redirect(signInUrl);
  }
}
```

## 🔒 **SECURITY PATTERNS**

### **Server-Controlled Role Validation**

```typescript
// User metadata is intentionally excluded because users can edit it.
export function isAdmin(user: AdminUser | null): boolean {
  if (!user) return false;

  if (ADMIN_USER_IDS.includes(user.id)) return true;

  return (
    user.app_metadata?.is_admin === true || user.app_metadata?.role === "admin"
  );
}
```

### **Secure Error Responses**

```typescript
// Standardized error responses with appropriate HTTP status codes
export async function authenticateAdmin() {
  const result = await requireAdmin();

  if (result.error) {
    return {
      success: false,
      error: result.error,
      status: result.error === "Authentication required" ? 401 : 403,
    };
  }

  return {
    success: true,
    user: result.user,
  };
}
```

### **Client-Side Status Checking**

```typescript
// Safe admin status checking for client components
export async function checkAdminStatus() {
  try {
    const supabase = createAPIServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        isUserAdmin: false,
        user: null,
        error: "Not authenticated",
      };
    }

    return {
      isUserAdmin: isAdmin(user as any),
      user,
      error: null,
    };
  } catch (error) {
    return {
      isUserAdmin: false,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
```

## 🚀 **USAGE PATTERNS**

### **API Route Protection**

```typescript
// Protecting admin-only API endpoints
export async function POST(request: NextRequest) {
  return withAdminAuth(async (user) => {
    // user is guaranteed to be an admin here
    const result = await performAdminOperation();
    return NextResponse.json({ success: true, data: result });
  });
}
```

### **Server Action Protection**

```typescript
// Protecting server actions with admin requirements
export const adminOnlyAction = withAdminServerAction(
  async (user, actionData) => {
    // user is guaranteed to be an admin here
    const result = await performSecureOperation(actionData);
    return { success: true, data: result };
  }
);
```

### **Middleware Integration**

```typescript
// Protecting admin routes in middleware.ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const adminCheck = await adminRouteGuard(request);
    if (adminCheck) return adminCheck;
  }

  return NextResponse.next();
}
```

### **Flexible Authorization**

```typescript
// Flexible admin checking for conditional features
export async function GET(request: NextRequest) {
  const isUserAdmin = await isAdminRequest();

  if (isUserAdmin) {
    // Return admin-specific data
    return NextResponse.json({ data: adminData, admin: true });
  } else {
    // Return public data
    return NextResponse.json({ data: publicData, admin: false });
  }
}
```

## 🔧 **INTEGRATION PATTERNS**

### **Supabase Integration**

```typescript
// Server-side Supabase client creation
const supabase = await createSupabaseServerClient();
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

// API server client for specific contexts
const supabase = createAPIServerClient();
const {
  data: { user },
  error,
} = await supabase.auth.getUser();
```

### **Error Handling Integration**

```typescript
// Consistent error responses across authentication layers
interface AdminAuthResult {
  success: boolean;
  user?: any;
  error?: string;
  status?: number;
}

// Standardized error response creation
return NextResponse.json({ error: "Admin access required" }, { status: 403 });
```

## 📱 **CLIENT-SERVER COMMUNICATION**

### **Authentication State Sharing**

```typescript
// Client-side admin status hook
export function useAdminStatus() {
  const [adminStatus, setAdminStatus] = useState(null);

  useEffect(() => {
    checkAdminStatus().then(setAdminStatus);
  }, []);

  return adminStatus;
}
```

### **Conditional UI Rendering**

```typescript
// Conditional admin UI components
function AdminPanel() {
  const { isUserAdmin, loading } = useAdminStatus();

  if (loading) return <LoadingSpinner />;
  if (!isUserAdmin) return <AccessDenied />;

  return <AdminDashboard />;
}
```

## 🧪 **TESTING STRATEGIES**

### **Authentication Testing**

- Mock Supabase auth responses
- Test admin role validation logic
- Verify error response formats
- Test middleware redirect behavior

### **Authorization Testing**

- Test access control with different user roles
- Verify protected route behavior
- Test admin wrapper functionality
- Validate error handling paths

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Role-based permissions beyond admin/user
- Fine-grained permission system
- Audit logging for admin actions
- Session management improvements
- Multi-factor authentication for admins

### **Security Improvements**

- Enhanced session validation
- IP-based access restrictions
- Rate limiting for admin endpoints
- Advanced threat detection
- Compliance logging

## 🏆 **BEST PRACTICES**

### **Security Guidelines**

1. **Principle of Least Privilege**: Grant minimal required permissions
2. **Defense in Depth**: Multiple layers of authentication checks
3. **Secure Defaults**: Deny access by default, grant explicitly
4. **Error Handling**: Secure error messages without information leakage
5. **Audit Trail**: Log all administrative actions

### **Development Guidelines**

1. **Consistent Patterns**: Use provided wrappers consistently
2. **Error Propagation**: Proper error handling and user feedback
3. **Type Safety**: Leverage TypeScript for compile-time safety
4. **Testing**: Comprehensive test coverage for auth flows
5. **Documentation**: Clear usage examples and security notes

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive admin authentication  
**Next Review**: After fine-grained permissions implementation
