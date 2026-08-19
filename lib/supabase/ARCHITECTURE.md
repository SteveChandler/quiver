# Supabase Integration Architecture

## PURPOSE

The `/lib/supabase` directory provides comprehensive Supabase integration utilities, including client configuration, server-side authentication, and file storage management for the Quiver surf community platform.

## DIRECTORY STRUCTURE

```
lib/supabase/
├── api-server-client.ts    # API route-specific Supabase client
├── client.ts               # Browser/client-side Supabase client
├── server.ts               # Server-side Supabase client
└── storage.ts              # File storage utilities and management
```

## ARCHITECTURE PATTERNS

### **Client Separation Pattern**

```typescript
SupabaseIntegration
├── Client-Side (client.ts)
│   ├── Browser-optimized configuration
│   ├── Real-time subscriptions
│   └── Client-side authentication
├── Server-Side (server.ts)
│   ├── SSR-compatible client
│   ├── Server component usage
│   └── Cookie-based session management
├── API Routes (api-server-client.ts)
│   ├── API route-specific client
│   ├── Request/response handling
│   └── Admin authentication support
└── Storage Management (storage.ts)
    ├── File upload utilities
    ├── Storage quota management
    └── Photo processing pipeline
```

### **Authentication Flow Architecture**

```typescript
AuthenticationFlow
├── Browser → Client → Authentication State
├── Server → Server Client → Session Validation
├── API Routes → API Client → Request Authentication
└── Storage → Authenticated Client → File Operations
```

### **Cookie Interface (`getAll`/`setAll` pattern)**

As of `@supabase/ssr` v0.8.0, all Supabase server clients use the `getAll`/`setAll` cookie interface. The previous `get`/`set`/`remove` interface is deprecated and has been fully migrated.

**Why `getAll`/`setAll`**: Supabase Auth may store session data across multiple cookies (e.g., chunked tokens). The `getAll`/`setAll` interface ensures all cookie chunks are read and written atomically, preventing session corruption and silent auth failures.

**Affected files (migrated February 2026)**:
- `lib/supabase/api-server-client.ts` -- both `createAPIServerClient` and `createAPIServerClientWithResponse`
- `lib/supabase.ts` -- `createServerClient` (guard check changed from `typeof cookieStore.get` to `typeof cookieStore.getAll`)
- `app/api/auth/[...supabase]/route.ts`
- `app/api/auth/check-session/route.ts`
- `app/api/auth/refresh-session/route.ts`
- `app/api/auth/supabase/resend-confirmation/route.ts`
- `app/api/plan-session/route.ts`
- `middleware.ts` (already used `getAll`/`setAll` before the migration)

## COMPONENT RESPONSIBILITIES

### **client.ts** (Browser Client)

- **Purpose**: Client-side Supabase configuration for browser environments
- **Features**:
  - Optimized for browser usage
  - Real-time subscription support
  - Automatic session management
  - Client-side authentication flows

**Implementation:**

```typescript
export const createClient = () => {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          "x-application-name": "quiver-surf-app",
        },
      },
    }
  );
};
```

### **server.ts** (Server Client)

- **Purpose**: Server-side Supabase client for SSR and server components
- **Features**:
  - Cookie-based session management via `getAll`/`setAll`
  - Server-side rendering support
  - Secure server-to-server communication
  - Request context preservation

### **api-server-client.ts** (API Route Client)

- **Purpose**: Specialized client for API routes with enhanced security
- **Features**:
  - API route-specific configuration
  - Request/response cookie handling via `getAll`/`setAll`
  - Admin authentication support
  - Configuration validation

**Core API Client (current `getAll`/`setAll` pattern):**

```typescript
export async function createAPIServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

**Request/Response Client (current `getAll`/`setAll` pattern):**

```typescript
export function createAPIServerClientWithResponse(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set({ name, value, ...options })
          );
        },
      },
    }
  );
}
```

**Authenticated API Client:**

```typescript
export async function getAuthenticatedAPIClient() {
  const supabase = await createAPIServerClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!user) {
      throw new Error("No authenticated user found");
    }

    return {
      supabase,
      user,
      authenticated: true,
    };
  } catch (error) {
    throw new Error(
      `Failed to get authenticated client: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
```

### **storage.ts** (File Storage Management)

- **Purpose**: Comprehensive file storage utilities with quota management
- **Features**:
  - Multi-file upload support
  - Image compression and validation
  - Storage quota tracking
  - Photo metadata management
  - Secure file operations

**File Upload Pipeline:**

Session-photo validation is centralized in
`lib/media/session-photo-policy.ts`: accepted JPEG/JPG/PNG/WebP input is limited
to 10 MiB before compression, while `SESSION_PHOTO_MAX_STORAGE_BYTES` limits the
compressed file to 5 MiB before the Supabase Storage upload.

```typescript
export async function uploadSessionPhoto(
  file: File,
  sessionId: string,
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check storage quota
    const storageInfo = await getUserStorageUsage(userId);
    if (!storageInfo.can_upload) {
      return {
        success: false,
        error: "Storage quota exceeded. Please delete some images first.",
      };
    }

    // Compress image
    const compressedFile = await compressImage(file);

    // Generate unique filename
    const fileExt = compressedFile.name.split(".").pop();
    const timestamp = Date.now();
    const fileName = `${sessionId}_${timestamp}.${fileExt}`;
    const filePath = `session-photos/${userId}/${fileName}`;

    // Upload to Supabase Storage
    const supabase = createClient();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("session-photos")
      .upload(filePath, compressedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("session-photos")
      .getPublicUrl(filePath);

    // Save to database
    const { data: photoData, error: dbError } = await supabase
      .from("session_photos")
      .insert({
        session_id: sessionId,
        user_id: userId,
        public_url: urlData.publicUrl,
        storage_path: filePath,
        file_size: compressedFile.size,
        metadata: {
          width: undefined, // Would be set by image processing
          height: undefined,
          compression_ratio: compressedFile.size / file.size,
        },
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file on database error
      await supabase.storage.from("session-photos").remove([filePath]);
      throw new Error(`Database error: ${dbError.message}`);
    }

    // Update storage usage
    await updateStorageUsage(userId, compressedFile.size);

    return {
      success: true,
      url: urlData.publicUrl,
      path: filePath,
      fileSize: compressedFile.size,
    };
  } catch (error) {
    console.error("Photo upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}
```

**Storage Quota Management:**

```typescript
export async function getUserStorageUsage(
  userId: string
): Promise<StorageUsageInfo> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("session_photos")
      .select("file_size")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch storage usage: ${error.message}`);
    }

    const totalBytes = data.reduce(
      (sum, photo) => sum + (photo.file_size || 0),
      0
    );
    const imageCount = data.length;

    // 500MB limit per user
    const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;
    const remainingBytes = Math.max(0, STORAGE_LIMIT_BYTES - totalBytes);
    const canUpload = remainingBytes > 1024 * 1024; // At least 1MB remaining

    return {
      total_bytes: totalBytes,
      image_count: imageCount,
      remaining_bytes: remainingBytes,
      can_upload: canUpload,
    };
  } catch (error) {
    console.error("Error fetching storage usage:", error);
    return {
      total_bytes: 0,
      image_count: 0,
      remaining_bytes: 0,
      can_upload: false,
    };
  }
}
```

**Image Compression:**

```typescript
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (max 1920x1080)
      const maxWidth = 1920;
      const maxHeight = 1080;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob!], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        "image/jpeg",
        0.8 // 80% quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}
```

## SECURITY PATTERNS

### **Configuration Validation**

```typescript
export function validateSupabaseConfig(): { valid: boolean; error?: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    return {
      valid: false,
      error: "NEXT_PUBLIC_SUPABASE_URL is not configured",
    };
  }

  if (!anonKey) {
    return {
      valid: false,
      error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured",
    };
  }

  try {
    new URL(url);
  } catch {
    return {
      valid: false,
      error: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL",
    };
  }

  if (!anonKey.startsWith("eyJ")) {
    return {
      valid: false,
      error: "NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid",
    };
  }

  return { valid: true };
}
```

### **File Validation**

```typescript
import {
  SESSION_PHOTO_MAX_STORAGE_BYTES,
  validateSessionPhotoInput,
} from "@/lib/media/session-photo-policy";

function validateFile(file: File): { valid: boolean; error?: string } {
  const validationError = validateSessionPhotoInput(file);
  if (validationError === "invalid_file_type") {
    return {
      valid: false,
      error: "Only JPEG, PNG, and WebP images are allowed",
    };
  }

  if (validationError === "file_too_large") {
    return {
      valid: false,
      error: "File size must be less than 10MB",
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "File appears to be empty",
    };
  }

  return { valid: true };
}

// After compression, reject output larger than
// SESSION_PHOTO_MAX_STORAGE_BYTES (5 MiB) before storage.upload().
```

## USAGE PATTERNS

### **Client-Side Usage**

```typescript
// React component with Supabase
import { createClient } from "@/lib/supabase/client";

function useRealtimeData() {
  const [data, setData] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("public:sessions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
        },
        (payload) => {
          setData((current) => [...current, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return data;
}
```

### **Server-Side Usage**

```typescript
// Server component with Supabase
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ServerComponent() {
  const supabase = await createSupabaseServerClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .limit(10);

  return (
    <div>
      {sessions?.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
```

### **API Route Usage**

```typescript
// API route with authentication
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

export async function GET() {
  const supabase = await createAPIServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_sessions")
    .select("*")
    .eq("user_id", user.id);

  return NextResponse.json({ sessions: data });
}
```

### **File Storage Usage**

```typescript
// Photo upload component
import { uploadSessionPhoto } from "@/lib/supabase/storage";

async function handlePhotoUpload(file: File, sessionId: string) {
  const result = await uploadSessionPhoto(file, sessionId, user.id);

  if (result.success) {
    toast.success("Photo uploaded successfully!");
    onPhotoAdded(result.url);
  } else {
    toast.error(result.error || "Upload failed");
  }
}
```

## TESTING STRATEGIES

### **Client Testing**

- Mock Supabase client responses
- Test authentication flows
- Verify real-time subscription cleanup
- Test error handling scenarios

### **Storage Testing**

- Test file upload pipeline
- Verify quota management
- Test compression functionality
- Validate error scenarios

## FUTURE ENHANCEMENTS

### **Planned Features**

- Enhanced file type support (video, audio)
- Advanced image processing (thumbnails, filters)
- CDN integration for global distribution
- Automated backup strategies
- Real-time collaborative features

### **Performance Improvements**

- Connection pooling optimization
- Advanced caching strategies
- Lazy loading for large datasets
- Background sync capabilities
- Edge function integration

## BEST PRACTICES

### **Client Management Guidelines**

1. **Environment Separation**: Use appropriate client for each context
2. **Authentication**: Validate user sessions consistently
3. **Error Handling**: Comprehensive error handling across all operations
4. **Resource Cleanup**: Proper cleanup of subscriptions and connections
5. **Security**: Validate all inputs and sanitize data

### **Cookie Interface Guidelines**

1. **Always use `getAll`/`setAll`**: The `get`/`set`/`remove` interface is deprecated in `@supabase/ssr` v0.8.0+
2. **Request/Response pattern**: In `createAPIServerClientWithResponse`, set cookies on both the request (for subsequent reads within the same request) and the response (for the browser)
3. **Server Components**: `setAll` is a no-op in `lib/supabase.ts` (server components cannot write cookies); API routes use `api-server-client.ts` which does support writes
4. **Guard check**: `lib/supabase.ts` validates `typeof cookieStore.getAll === "function"` before using the SSR client; falls back to a basic client without cookies otherwise

### **Storage Management Guidelines**

1. **Quota Management**: Track and enforce storage limits
2. **File Validation**: Comprehensive file type and size validation
3. **Compression**: Optimize file sizes for performance
4. **Cleanup**: Remove orphaned files and manage deletions
5. **Monitoring**: Track storage usage and performance metrics

---

**Last Updated**: February 2026
**Status**: Production-ready with comprehensive Supabase integration
**Next Review**: After CDN integration and advanced image processing
