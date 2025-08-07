# Profile Components Architecture

## 🎯 **PURPOSE**

The profile components provide comprehensive user profile management including personal information, board collection, preferences, activity tracking, and social interactions.

## 📁 **COMPONENT STRUCTURE**

```
components/profile/
├── basic-profile-form.tsx    # Core profile information and avatar
├── boards-manager.tsx        # Surfboard collection CRUD
├── profile-edit-form.tsx     # Composite profile editing page
├── profile-preferences.tsx   # User preferences and default beach
├── recent-sessions-list.tsx  # Recent surf sessions display
└── user-comments.tsx         # User's comment history
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Composite Profile Architecture**

```typescript
ProfileEditForm (Container)
├── BasicProfileForm (Personal Info)
├── ProfilePreferences (Settings)
├── BoardsManager (Equipment)
├── RecentSessionsList (Activity)
└── UserComments (Social History)
```

### **Form Management Pattern**

```typescript
// Shared form pattern across components
const form = useForm<FormValues>({
  resolver: zodResolver(validationSchema),
  defaultValues: profileData,
});

// Consistent form submission
async function onSubmit(data: FormValues) {
  try {
    const result = await updateProfileAction(data);
    if (result.success) {
      toast.success("Profile updated successfully");
    }
  } catch (error) {
    toast.error("Failed to update profile");
  }
}
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **BasicProfileForm** (Core Information)

- **Purpose**: Personal information and avatar management
- **Props**: `userId, email, profile`
- **Features**:
  - Full name, username, bio editing
  - Avatar upload with cropping
  - Email display (read-only)
  - Profile validation and submission

**Avatar Management:**

```typescript
const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validate file type and size
  if (!file.type.startsWith("image/")) {
    toast.error("Please select an image file");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    // 5MB limit
    toast.error("Image must be less than 5MB");
    return;
  }

  // Upload and update profile
  const result = await uploadAvatarAction(userId, file);
  if (result.success) {
    setAvatarUrl(result.data.avatar_url);
    toast.success("Avatar updated successfully");
  }
};
```

### **BoardsManager** (Equipment Management)

- **Purpose**: CRUD operations for user's surfboard collection
- **Props**: `userId, boards`
- **Features**:
  - Board creation with detailed specifications
  - Board editing and deletion
  - Board type categorization
  - Image upload for boards
  - Usage tracking integration

**Board Management System:**

```typescript
interface Board {
  id: string;
  user_id: string;
  name: string;
  board_type: string;
  dimensions: string;
  description?: string;
  image_url?: string;
  created_at: string;
}

// Board form validation
const boardFormSchema = z.object({
  name: z.string().min(1, "Board name is required").max(100),
  board_type: z.string().min(1, "Board type is required"),
  dimensions: z.string().min(1, "Dimensions are required"),
  description: z.string().optional(),
});
```

**CRUD Operations:**

```typescript
const handleAddBoard = async (data: BoardFormValues) => {
  const result = await createBoardAction(userId, data);
  if (result.success) {
    setBoards((prev) => [...prev, result.data]);
    resetForm();
    toast.success("Board added successfully");
  }
};

const handleDeleteBoard = async () => {
  if (!boardToDelete) return;
  const result = await deleteBoardAction(boardToDelete.id);
  if (result.success) {
    setBoards((prev) => prev.filter((b) => b.id !== boardToDelete.id));
    setDeleteDialogOpen(false);
    toast.success("Board deleted successfully");
  }
};
```

### **ProfilePreferences** (User Settings)

- **Purpose**: User preferences and default beach selection
- **Props**: `userId, profile, beaches`
- **Features**:
  - Default beach selection with search
  - Privacy settings
  - Notification preferences
  - Display preferences

**Beach Selection:**

```typescript
// Beach selection with search
<FormField
  control={form.control}
  name="default_beach_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Default Beach</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <SelectContent>
          {beaches.map((beach) => (
            <SelectItem key={beach.id} value={beach.id}>
              {beach.name} - {beach.location}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormItem>
  )}
/>
```

### **RecentSessionsList** (Activity Display)

- **Purpose**: Display user's recent surf sessions
- **Props**: `recentSessions`
- **Features**:
  - Chronological session list
  - Session summary cards
  - Quick navigation to session details
  - Empty state handling

**Session Display:**

```typescript
{
  recentSessions.length > 0 ? (
    <div className="space-y-3">
      {recentSessions.map((session) => (
        <Card key={session.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">{session.beach?.name}</h4>
              <p className="text-sm text-muted-foreground">
                {format(new Date(session.session_date), "PPP")}
              </p>
            </div>
            <Link href={`/sessions/${session.id}`}>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
          </div>
        </Card>
      ))}
    </div>
  ) : (
    <EmptyStateCard />
  );
}
```

### **UserComments** (Social History)

- **Purpose**: Display and manage user's comment history
- **Props**: `userId`
- **Features**:
  - Comment list with context (beach/session)
  - Comment deletion capability
  - Pagination for large comment lists
  - Context navigation

**Comment Management:**

```typescript
const fetchComments = async () => {
  const { data, error } = await supabase
    .from("comments")
    .select(
      `
      *,
      session:sessions(
        beach:beaches(name)
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

const handleDeleteComment = async (commentId: string) => {
  const result = await deleteCommentAction(commentId);
  if (result.success) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    toast.success("Comment deleted");
  }
};
```

### **ProfileEditForm** (Main Container)

- **Purpose**: Composite profile editing interface
- **Props**: `userId, email, profile, boards, recentSessions, beaches`
- **Features**:
  - Tabbed interface for different profile sections
  - Consistent styling and layout
  - Form state management
  - Navigation between sections

## 🎨 **DESIGN PATTERNS**

### **Consistent Form Layout**

```typescript
// Standardized form pattern using DRY components
<CardFormLayout
  title="Profile Information"
  description="Update your profile details"
  form={form}
  onSubmit={form.handleSubmit(onSubmit)}
>
  <FormInput control={form.control} name="full_name" label="Full Name" />
  <FormTextarea control={form.control} name="bio" label="Bio" />
</CardFormLayout>
```

### **Avatar Display System**

```typescript
// Consistent avatar display with fallbacks
<Avatar className="h-20 w-20">
  <AvatarImage src={avatarUrl || profile?.avatar_url || ""} />
  <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
</Avatar>;

const getInitials = () => {
  const name = profile?.full_name || profile?.username || email;
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
```

### **Modal Management Pattern**

```typescript
// Consistent modal pattern for CRUD operations
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [boardToEdit, setBoardToEdit] = useState<Board | null>(null);

const openEditDialog = (board: Board) => {
  setBoardToEdit(board);
  form.reset(board);
  setEditDialogOpen(true);
};
```

### **Loading and Error States**

```typescript
// Consistent loading patterns
{
  loading ? (
    <div className="flex justify-center py-8">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ) : error ? (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : (
    <ContentDisplay />
  );
}
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Efficient Data Loading**

```typescript
// Memoized data fetching
const fetchComments = useCallback(async () => {
  // Expensive query with joins
  return await getCommentsWithContext(userId);
}, [userId]);

const { data: comments, loading } = useDataFetcher(fetchComments);
```

### **Form Optimization**

```typescript
// Debounced form submission
const debouncedSubmit = useMemo(
  () =>
    debounce(async (data: FormValues) => {
      await updateProfileAction(data);
    }, 1000),
  []
);

// Optimistic updates for better UX
const handleOptimisticUpdate = (field: string, value: any) => {
  setProfile((prev) => ({ ...prev, [field]: value }));
  debouncedSubmit(form.getValues());
};
```

## 🔄 **SERVER INTEGRATION**

### **Server Actions Pattern**

```typescript
// Consistent server action integration
export async function updateProfileAction(data: ProfileFormValues) {
  try {
    const { data: updatedProfile, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data: updatedProfile };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### **Real-Time Updates**

```typescript
// Profile updates with cache invalidation
useEffect(() => {
  const channel = supabase
    .channel("profile_changes")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        setProfile(payload.new);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId]);
```

## 📱 **MOBILE OPTIMIZATION**

### **Responsive Form Layout**

```typescript
// Mobile-first form design
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <FormInput name="full_name" label="Full Name" />
  <FormInput name="username" label="Username" />
</div>

// Mobile-optimized board cards
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### **Touch-Friendly Interface**

```typescript
// Large touch targets for mobile
<Button size="lg" className="w-full md:w-auto">
  Save Changes
</Button>

// Accessible modal controls
<DialogClose asChild>
  <Button variant="outline" className="w-full">Cancel</Button>
</DialogClose>
```

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Form validation and submission
- Avatar upload functionality
- Board CRUD operations
- Modal state management

### **Integration Testing**

- Profile update workflows
- Board management flows
- Social interaction features
- Real-time update handling

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Advanced privacy controls
- Profile themes and customization
- Board recommendation system
- Social profile features (followers, following)
- Activity analytics and insights

### **Performance Improvements**

- Progressive form loading
- Image optimization for avatars
- Background sync for preferences
- Offline profile editing

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive profile management  
**Next Review**: After social profile features implementation
