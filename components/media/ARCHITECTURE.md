# Media Components Architecture

## 🎯 **PURPOSE**

The media components provide a comprehensive photo management system for surf sessions with gallery display, upload functionality, and storage quota management.

## 📁 **COMPONENT STRUCTURE**

```
components/media/
├── session-photo-gallery.tsx    # Photo gallery with lightbox and editing
├── session-photo-upload.tsx     # File upload with compression preview
└── storage-usage-widget.tsx     # Storage quota monitoring widget
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Media Management Architecture**

```typescript
MediaSystem
├── SessionPhotoGallery (Display & Management)
├── SessionPhotoUpload (File Processing & Upload)
└── StorageUsageWidget (Quota Monitoring)
```

### **File Lifecycle Pattern**

```typescript
// File processing pipeline
FileSelection → Validation → Preview → Compression → Upload → Gallery Display
     ↓              ↓           ↓           ↓          ↓         ↓
  File Input → Error Check → Thumbnails → Size Reduce → Server → Public URL
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **SessionPhotoGallery** (Photo Management)

- **Purpose**: Comprehensive photo gallery with editing capabilities
- **Props**: `sessionId, photos, canEdit, showMetadata, onPhotosChange`
- **Features**:
  - Responsive grid layout (2-4 columns)
  - Lightbox modal with navigation
  - In-place caption editing
  - Photo deletion with confirmation
  - Metadata display (file size, dimensions, dates)
  - Empty state with call-to-action

**Core Features:**

```typescript
interface SessionPhoto {
  id: string;
  session_id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  caption?: string;
  file_size: number;
  metadata?: {
    width?: number;
    height?: number;
    compression_ratio?: number;
  };
  created_at: string;
}
```

**Lightbox Navigation:**

```typescript
// Navigation with keyboard support
const navigateLightbox = (direction: "prev" | "next") => {
  const newIndex =
    direction === "prev"
      ? (currentIndex - 1 + photos.length) % photos.length
      : (currentIndex + 1) % photos.length;
};

// Photo counter and controls
{
  photos.length > 1 && (
    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
      {currentIndex + 1} of {photos.length}
    </div>
  );
}
```

### **SessionPhotoUpload** (File Processing)

- **Purpose**: Multi-file upload with validation and compression preview
- **Props**: `sessionId, onUploadComplete, maxPhotos, disabled`
- **Features**:
  - Drag & drop file selection
  - Multiple file validation
  - Storage quota checking
  - Compression simulation
  - Progress tracking
  - File preview grid

**File Validation System:**

The shared policy in `lib/media/session-photo-policy.ts` is the source of truth:
it accepts JPEG/JPG/PNG/WebP input up to 10 MiB before compression. The storage
helper separately enforces a 5 MiB limit after compression.

```typescript
import { validateSessionPhotoInput } from "@/lib/media/session-photo-policy";

const validateFile = (file: File): string | null => {
  const validationError = validateSessionPhotoInput(file);
  if (validationError === "invalid_file_type") {
    return "Only JPEG, PNG, and WebP images are allowed";
  }
  if (validationError === "file_too_large") {
    return "File size must be less than 10MB";
  }
  return null;
};
```

**Upload Process:**

```typescript
// FormData preparation for server action
const formData = new FormData();
formData.append("fileCount", files.length.toString());
files.forEach((filePreview, index) => {
  formData.append(`file_${index}`, filePreview.file);
});

// Progress simulation with real server action
const result = await uploadSessionPhotosAction(sessionId, formData);
```

### **StorageUsageWidget** (Quota Management)

- **Purpose**: Visual storage quota monitoring with usage warnings
- **Props**: `className, showDetails, refreshTrigger`
- **Features**:
  - Animated progress bar with color coding
  - Storage statistics (used/remaining/image count)
  - Usage warnings at 75%/90% thresholds
  - Storage tips and compression info
  - Real-time updates with refresh trigger

**Storage Logic:**

```typescript
interface StorageStats {
  total_bytes: number;
  image_count: number;
  remaining_bytes: number;
  usage_percentage: number;
}

const getUsageColor = (percentage: number): string => {
  if (percentage >= 90) return "text-red-600";
  if (percentage >= 75) return "text-yellow-600";
  return "text-green-600";
};
```

## 🎨 **DESIGN PATTERNS**

### **Responsive Grid Layouts**

```typescript
// Gallery grid that adapts to screen size
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">

// Upload preview grid
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
```

### **Progressive Disclosure**

```typescript
// Hover-revealed action buttons
<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
  <Button onClick={startEditingCaption}>
    <Edit2 className="h-3 w-3" />
  </Button>
  <Button onClick={handleDeletePhoto}>
    <Trash2 className="h-3 w-3" />
  </Button>
</div>
```

### **Loading State Management**

```typescript
// Upload progress with visual feedback
{
  isUploading ? (
    <div className="text-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <Progress value={uploadProgress} className="w-32" />
    </div>
  ) : (
    <FileUploadInterface />
  );
}
```

### **Color-Coded Status System**

```typescript
// Storage usage color coding
const progressColors = {
  safe: "bg-green-500", // < 75%
  warning: "bg-yellow-500", // 75-90%
  danger: "bg-red-500", // > 90%
};

// File size display with compression preview
{
  filePreview.compressedSize && (
    <span className="text-green-600">
      → {formatFileSize(filePreview.compressedSize)}
    </span>
  );
}
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Lazy Loading & Memory Management**

```typescript
// URL cleanup to prevent memory leaks
const removeFile = useCallback((id: string) => {
  setFiles((prev) => {
    const fileToRemove = prev.find((f) => f.id === id);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.url); // Critical cleanup
    }
    return prev.filter((f) => f.id !== id);
  });
}, []);

// Cleanup on component unmount
useEffect(() => {
  return () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
  };
}, []);
```

### **Efficient File Processing**

```typescript
// Batch file processing with validation
const processFiles = useCallback(async (fileList: FileList) => {
  const newFiles: FilePreview[] = [];
  const errors: string[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const validationError = validateFile(file);

    if (!validationError) {
      newFiles.push({
        file,
        url: URL.createObjectURL(file),
        id: `${Date.now()}-${i}`,
        originalSize: file.size,
        compressing: true,
      });
    } else {
      errors.push(`${file.name}: ${validationError}`);
    }
  }
}, []);
```

### **Storage Optimization**

```typescript
// Compression simulation and preview
setTimeout(() => {
  setFiles((prev) =>
    prev.map((f) =>
      newFiles.find((nf) => nf.id === f.id)
        ? {
            ...f,
            compressing: false,
            compressedSize: Math.floor(f.originalSize * 0.6), // 40% reduction
          }
        : f
    )
  );
}, 1000);
```

## 🔄 **SERVER INTEGRATION**

### **Server Actions Integration**

```typescript
// Upload action with progress tracking
const result = await uploadSessionPhotosAction(sessionId, formData);

if (result.success) {
  toast.success(`Successfully uploaded ${result.data.uploaded} photo(s)`);
  if (result.data.failed > 0) {
    toast.warning(`${result.data.failed} photo(s) failed to upload`);
  }
}

// Storage stats action
const storageResult = await getStorageStatsAction();
```

### **Real-Time Updates**

```typescript
// Refresh storage info after upload
await loadStorageInfo();
onUploadComplete(result.data.uploaded);

// Photo list updates
const updatedPhotos = photos.filter((p) => p.id !== photoId);
setPhotos(updatedPhotos);
onPhotosChange?.(updatedPhotos);
```

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Interface**

```typescript
// Large touch targets for mobile
<Button className="h-8 w-8 p-0">
  <Edit2 className="h-3 w-3" />
</Button>;

// Touch-optimized drag & drop
onDragOver = { handleDragOver };
onDragLeave = { handleDragLeave };
onDrop = { handleDrop };
```

### **Responsive Lightbox**

```typescript
// Mobile-optimized modal
<DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
  <img className="w-full max-h-[70vh] object-contain" />
  // Mobile navigation buttons
  <Button className="absolute left-2 top-1/2 transform -translate-y-1/2">
    <ChevronLeft className="h-4 w-4" />
  </Button>
</DialogContent>
```

## 🔒 **SECURITY & VALIDATION**

### **File Security**

```typescript
// Shared input policy: accepted MIME types and the 10 MiB pre-compression limit.
import {
  SESSION_PHOTO_MAX_STORAGE_BYTES,
} from "@/lib/media/session-photo-policy";

// Storage policy: the compressed output must be at most 5 MiB.
if (compressedFile.size > SESSION_PHOTO_MAX_STORAGE_BYTES) {
  return "File is too large after compression";
}

// Storage quota enforcement
if (!storageInfo?.can_upload) {
  setError("Storage quota exceeded. Please delete some images first.");
}
```

### **Data Sanitization**

```typescript
// Caption input validation
<Input
  value={captionText}
  onChange={(e) => setCaptionText(e.target.value)}
  placeholder="Add a caption..."
  maxLength={500} // Prevent abuse
/>
```

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- File upload and validation
- Gallery navigation and editing
- Storage quota warnings
- Mobile touch interactions

### **Integration Testing**

- Server action integration
- Storage quota updates
- Real-time photo updates
- Error handling flows

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Image editing tools (crop, rotate, filters)
- Batch operations (select multiple, bulk delete)
- Photo tagging and search
- Social sharing integration
- Video upload support

### **Performance Improvements**

- Progressive image loading
- WebP conversion optimization
- Background upload queuing
- Offline photo caching

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive photo management  
**Next Review**: After image editing tools implementation
