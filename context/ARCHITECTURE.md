# Context Directory Architecture

## 🎯 **PURPOSE**

The `/context` directory provides centralized state management and authentication logic for the Quiver surf community platform, implementing React Context patterns for global application state.

## 📁 **DIRECTORY STRUCTURE**

```
context/
└── auth-context.tsx    # Authentication state management and Supabase integration
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Authentication Context Pattern**

```typescript
AuthProvider (Global State Container)
├── Authentication State Management
├── Session Management & Persistence
├── User State Synchronization
└── Authentication Actions (sign-in, sign-up, sign-out)
```

### **Context Provider Hierarchy**

```typescript
// Application context structure
<AuthProvider>
  <ClientApp>{/* All components have access to auth state */}</ClientApp>
</AuthProvider>
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **AuthContext** (Authentication Management)

- **Purpose**: Centralized authentication state management with Supabase integration
- **Features**:
  - User session management with persistence
  - Authentication state tracking (loading, authenticated, user data)
  - Automatic session refresh and validation
  - Server-side and client-side compatibility
  - Comprehensive error handling and recovery

**Core Interface:**

```typescript
interface AuthContextType {
  // State
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
```

### **AuthProvider** (State Provider)

- **Purpose**: Provides authentication context to the entire application
- **Features**:
  - Global authentication state management
  - Automatic session initialization on app load
  - Real-time session state updates via Supabase listeners
  - Timeout handling for slow network connections
  - Memory leak prevention with proper cleanup

**State Management Pattern:**

```typescript
// Centralized state updates
const updateAuthState = (newSession: Session | null) => {
  setSession(newSession);
  setUser(newSession?.user || null);
  setIsAuthenticated(!!newSession);

  // Setup user account if needed
  if (newSession?.user && !setupCompleteRef.current) {
    setupUserAccount(newSession.user.id);
  }
};
```

## 🔄 **AUTHENTICATION FLOW**

### **Initialization Sequence**

```typescript
// Client-side initialization flow
1. AuthProvider mounts
2. Check for existing Supabase session
3. Set up auth state change listener
4. Update global authentication state
5. Initialize user account setup if needed
```

### **Session Management**

```typescript
// Session lifecycle management
useEffect(() => {
  const initializeAuth = async () => {
    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // Update state
    updateAuthState(session);

    // Set up real-time listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      updateAuthState(session);
    });

    return () => subscription.unsubscribe();
  };

  initializeAuth();
}, []);
```

### **Error Handling Strategy**

```typescript
// Robust error handling
try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Success handled by onAuthStateChange listener
} catch (error) {
  console.error("Sign in error:", error);
  updateAuthState(null); // Clear state on error
  throw error; // Re-throw for component handling
}
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Memory Management**

```typescript
// Prevent race conditions and memory leaks
const initializingRef = useRef(false);
const setupCompleteRef = useRef(false);

// Cleanup on unmount
useEffect(() => {
  return () => {
    mounted = false;
    if (timeoutId) clearTimeout(timeoutId);
    if (subscription) subscription.unsubscribe();
    initializingRef.current = false;
  };
}, []);
```

### **Connection Timeout Handling**

```typescript
// Reasonable timeout for slow connections
const timeoutId = setTimeout(() => {
  if (mounted && initializingRef.current) {
    console.warn("Auth initialization timed out after 15s");
    updateAuthState(null);
    setIsLoading(false);
    setIsInitialized(true);
    initializingRef.current = false;
  }
}, 15000); // 15 second timeout
```

### **Server-Side Compatibility**

```typescript
// SSR-safe initialization
if (typeof window !== "undefined") {
  console.log("Browser detected, initializing...");
  initializeAuth();
} else {
  // Server side - set defaults immediately
  console.log("Server side, setting defaults");
  setIsLoading(false);
  setIsInitialized(true);
}
```

## 🔒 **SECURITY PATTERNS**

### **Session Validation**

```typescript
// Automatic session refresh on demand
const refreshSession = async (): Promise<void> => {
  if (initializingRef.current) return;

  initializingRef.current = true;
  setIsLoading(true);

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Session refresh error:", error);
      updateAuthState(null);
      return;
    }

    updateAuthState(session);
  } finally {
    setIsLoading(false);
    initializingRef.current = false;
  }
};
```

### **Clean State Management**

```typescript
// Clean sign-out process
const signOut = async (): Promise<void> => {
  setIsLoading(true);

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Reset setup state
    setupCompleteRef.current = false;

    // onAuthStateChange listener handles state clearing
  } catch (error) {
    console.error("Sign out error:", error);
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

## 🧪 **TESTING STRATEGY**

### **Authentication Flow Testing**

- User sign-up and email verification
- User sign-in with valid/invalid credentials
- Session persistence across page reloads
- Automatic sign-out on session expiry
- Error handling for network failures

### **State Management Testing**

- Context provider initialization
- State updates via auth actions
- Loading states during auth operations
- Error states and recovery
- Memory leak prevention

## 🔄 **INTEGRATION PATTERNS**

### **With Protected Routes**

```typescript
// Component usage example
const ProtectedComponent = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <SignInPrompt />;

  return <AuthenticatedContent user={user} />;
};
```

### **With Server Actions**

```typescript
// Authentication wrapper for server actions
import { withAuthenticatedAction } from "@/lib/server-action-utils";

export const protectedAction = withAuthenticatedAction(
  async (userId, ...args) => {
    // Action implementation with guaranteed user ID
  }
);
```

## 📱 **CLIENT-SIDE OPTIMIZATION**

### **Hydration Safety**

```typescript
// Prevent hydration mismatches
const [isInitialized, setIsInitialized] = useState(false);

// Only render auth-dependent content after initialization
{
  isInitialized && <AuthDependentComponent />;
}
```

### **State Persistence**

```typescript
// Automatic session recovery
useEffect(() => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Restore user state from valid session
  if (session) {
    updateAuthState(session);
  }
}, []);
```

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Multi-factor authentication support
- Social login providers (Google, Apple)
- Session management dashboard
- Advanced user preferences
- Real-time user status updates

### **Performance Improvements**

- Context splitting for reduced re-renders
- Optimistic authentication updates
- Background session validation
- Progressive authentication loading

## 🏆 **BEST PRACTICES**

### **Context Design Patterns**

1. **Single Responsibility**: Auth context only handles authentication
2. **Error Boundaries**: Comprehensive error handling and recovery
3. **Memory Safety**: Proper cleanup and ref management
4. **Type Safety**: Full TypeScript coverage with strict types
5. **SSR Compatibility**: Works seamlessly with Next.js SSR

### **Authentication Security**

1. **Session Validation**: Regular session checks and refresh
2. **Error Handling**: Secure error messages without sensitive data
3. **State Cleanup**: Proper state clearing on sign-out
4. **Timeout Handling**: Graceful handling of slow connections
5. **CSRF Protection**: Supabase handles CSRF protection automatically

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive authentication management  
**Next Review**: After multi-factor authentication implementation
