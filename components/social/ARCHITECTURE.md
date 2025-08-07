# Social Components Architecture

## 🎯 **PURPOSE**

The social components provide comprehensive community features including activity feeds, follow relationships, user profiles, and social interactions for the surf community.

## 📁 **COMPONENT STRUCTURE**

```
components/social/
├── activity-feed.tsx            # Activity feed with filtering
├── follow-button.tsx            # Follow/unfollow functionality
├── followers-modal.tsx          # Followers/following list modal
├── unified-community-feed.tsx   # Combined activity and session feed
├── user-profile-modal.tsx       # User profile quick view
└── user-social-stats.tsx        # Social statistics display
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Social Graph Architecture**

```typescript
SocialSystem
├── ActivityFeed (Personal/Global Activity)
├── FollowRelationships (User Connections)
├── UserProfiles (Social Identity)
├── CommunityFeed (Unified Content)
└── SocialStats (Engagement Metrics)
```

### **Real-Time Social Updates**

```typescript
// WebSocket/Supabase subscription pattern
useEffect(() => {
  const channel = supabase
    .channel("social_updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "activities",
      },
      handleActivityUpdate
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

### **Optimistic UI Pattern**

```typescript
// Immediate UI updates with rollback on failure
const handleOptimisticFollow = async (userId: string) => {
  // Update UI immediately
  setIsFollowing(true);
  setFollowersCount((prev) => prev + 1);

  try {
    const result = await followUserAction(userId);
    if (!result.success) {
      // Rollback on failure
      setIsFollowing(false);
      setFollowersCount((prev) => prev - 1);
    }
  } catch (error) {
    // Rollback on error
    setIsFollowing(false);
    setFollowersCount((prev) => prev - 1);
  }
};
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **ActivityFeed** (Activity Stream)

- **Purpose**: Display chronological activity feed with filtering
- **Props**: `userId, limit, autoRefresh, className`
- **Features**:
  - Personal vs global feed modes
  - Real-time activity updates
  - Activity type filtering
  - Infinite scroll pagination
  - Auto-refresh capability

**Activity Types:**

```typescript
interface ActivityFeedItem {
  id: string;
  user_id: string;
  activity_type:
    | "session_logged"
    | "session_planned"
    | "comment_posted"
    | "beach_reviewed"
    | "user_followed"
    | "board_added";
  entity_type: "session" | "comment" | "review" | "user" | "board";
  entity_id: string;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string;
  };
}
```

**Activity Rendering:**

```typescript
const renderActivityText = (activity: ActivityFeedItem) => {
  switch (activity.activity_type) {
    case "session_logged":
      return `logged a surf session at ${activity.metadata?.beach_name}`;
    case "session_planned":
      return `planned a surf session at ${activity.metadata?.beach_name}`;
    case "comment_posted":
      return `commented on a session`;
    case "beach_reviewed":
      return `reviewed ${activity.metadata?.beach_name}`;
    case "user_followed":
      return `started following ${activity.metadata?.target_user_name}`;
    default:
      return "had some activity";
  }
};
```

### **FollowButton** (Relationship Management)

- **Purpose**: Follow/unfollow functionality with state management
- **Props**: `userId, initialCounts, variant, size, showCounts`
- **Features**:
  - Optimistic UI updates
  - Real-time follower count updates
  - Multiple visual variants
  - Loading and error states
  - Bulk follow operations

**Follow State Management:**

```typescript
const FollowButton = ({ userId, ...props }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [loading, setLoading] = useState(false);

  const handleToggleFollow = async () => {
    if (loading) return;

    setLoading(true);
    const newFollowState = !isFollowing;

    // Optimistic update
    setIsFollowing(newFollowState);
    setFollowersCount((prev) => prev + (newFollowState ? 1 : -1));

    try {
      const result = newFollowState
        ? await followUserAction(userId)
        : await unfollowUserAction(userId);

      if (!result.success) {
        // Rollback optimistic update
        setIsFollowing(!newFollowState);
        setFollowersCount((prev) => prev + (newFollowState ? -1 : 1));
        toast.error(result.error);
      }
    } catch (error) {
      // Rollback on error
      setIsFollowing(!newFollowState);
      setFollowersCount((prev) => prev + (newFollowState ? -1 : 1));
      toast.error("Failed to update follow status");
    } finally {
      setLoading(false);
    }
  };
};
```

### **FollowersModal** (Connection Lists)

- **Purpose**: Display followers/following lists with management
- **Props**: `userId, type, isOpen, onClose`
- **Features**:
  - Followers vs following toggle
  - User search and filtering
  - Follow/unfollow from within modal
  - Infinite scroll for large lists
  - User profile quick access

**Connection Management:**

```typescript
interface UserConnection {
  id: string;
  created_at: string;
  follower?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
  following?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
}

const fetchConnections = async () => {
  const { data, error } = await supabase
    .from("follows")
    .select(
      `
      id,
      created_at,
      ${
        type === "followers"
          ? "follower:profiles!follows_follower_id_fkey"
          : "following:profiles!follows_following_id_fkey"
      }(
        id,
        full_name,
        avatar_url,
        email
      )
    `
    )
    .eq(type === "followers" ? "following_id" : "follower_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};
```

### **UnifiedCommunityFeed** (Content Aggregation)

- **Purpose**: Combined activity and session feed for community page
- **Props**: `sessions, userId, loading, className`
- **Features**:
  - Mixed content types (activities + sessions)
  - Chronological sorting
  - Content deduplication
  - Rich session previews
  - User interaction handling

**Content Aggregation:**

```typescript
type FeedItem = {
  id: string;
  type: "activity" | "session";
  created_at: string;
  data: ActivityFeedItem | SessionWithDetails;
};

const aggregatedFeed = useMemo(() => {
  const activityItems: FeedItem[] = activities.map((activity) => ({
    id: `activity-${activity.id}`,
    type: "activity",
    created_at: activity.created_at,
    data: activity,
  }));

  const sessionItems: FeedItem[] = sessions.map((session) => ({
    id: `session-${session.id}`,
    type: "session",
    created_at: session.created_at,
    data: session,
  }));

  return [...activityItems, ...sessionItems]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 50); // Limit for performance
}, [activities, sessions]);
```

### **UserProfileModal** (Quick Profile View)

- **Purpose**: Modal for quick user profile viewing
- **Props**: `userId, isOpen, onClose`
- **Features**:
  - Comprehensive user information
  - Recent activity preview
  - Follow/message buttons
  - Session statistics
  - Social stats display

### **UserSocialStats** (Social Metrics)

- **Purpose**: Display user's social engagement statistics
- **Props**: `profile, className`
- **Features**:
  - Follower/following counts
  - Session statistics
  - Engagement metrics
  - Achievement badges
  - Activity level indicators

## 🎨 **DESIGN PATTERNS**

### **Consistent Social UI**

```typescript
// Standard social interaction buttons
<div className="flex items-center space-x-2">
  <FollowButton userId={user.id} variant="outline" size="sm" />
  <Button variant="ghost" size="sm">
    <MessageCircle className="h-4 w-4 mr-1" />
    Message
  </Button>
</div>
```

### **Real-Time Indicators**

```typescript
// Live activity indicators
{
  isOnline && (
    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
  );
}

// Real-time count updates
<Badge variant="secondary">
  {followersCount} {followersCount === 1 ? "follower" : "followers"}
</Badge>;
```

### **Progressive Enhancement**

```typescript
// Graceful degradation for social features
{
  user ? (
    <FollowButton userId={targetUserId} />
  ) : (
    <Button onClick={() => router.push("/auth/sign-in")}>
      Sign in to follow
    </Button>
  );
}
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Efficient Data Loading**

```typescript
// Paginated activity loading with cursor-based pagination
const loadMoreActivities = useCallback(async () => {
  if (loading || !hasMore) return;

  setLoading(true);
  try {
    const newActivities = await getActivities({
      userId,
      limit: 20,
      cursor: lastActivityId,
    });

    setActivities((prev) => [...prev, ...newActivities]);
    setLastActivityId(newActivities[newActivities.length - 1]?.id);
    setHasMore(newActivities.length === 20);
  } finally {
    setLoading(false);
  }
}, [userId, lastActivityId, loading, hasMore]);
```

### **Smart Caching**

```typescript
// Cache user profiles to avoid repeated fetches
const userProfileCache = new Map<string, UserProfile>();

const getCachedUserProfile = useCallback(async (userId: string) => {
  if (userProfileCache.has(userId)) {
    return userProfileCache.get(userId);
  }

  const profile = await fetchUserProfile(userId);
  userProfileCache.set(userId, profile);
  return profile;
}, []);
```

### **Debounced Search**

```typescript
// Debounced user search in modals
const debouncedSearch = useMemo(
  () =>
    debounce(async (query: string) => {
      if (query.length < 2) return;
      const results = await searchUsers(query);
      setSearchResults(results);
    }, 300),
  []
);
```

## 🔄 **REAL-TIME FEATURES**

### **Live Activity Updates**

```typescript
// Real-time activity feed updates
useEffect(() => {
  if (!autoRefresh) return;

  const channel = supabase
    .channel("activity_feed")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "activities",
        filter: userId ? `user_id=eq.${userId}` : undefined,
      },
      (payload) => {
        setActivities((prev) => [payload.new as ActivityFeedItem, ...prev]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId, autoRefresh]);
```

### **Follow Relationship Updates**

```typescript
// Real-time follow count updates
useEffect(() => {
  const channel = supabase
    .channel("follow_updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "follows",
        filter: `following_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          setFollowersCount((prev) => prev + 1);
        } else if (payload.eventType === "DELETE") {
          setFollowersCount((prev) => prev - 1);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [userId]);
```

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Social Actions**

```typescript
// Large touch targets for social buttons
<Button size="lg" className="min-h-[44px] min-w-[44px]">
  <Heart className="h-5 w-5" />
</Button>

// Swipe gestures for feed navigation
<div
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
  className="overflow-x-hidden"
>
```

### **Mobile-Optimized Modals**

```typescript
// Full-screen modals on mobile
<Dialog>
  <DialogContent className="sm:max-w-md w-full h-full sm:h-auto">
    <div className="flex flex-col h-full">
      <DialogHeader />
      <div className="flex-1 overflow-y-auto">{/* Content */}</div>
    </div>
  </DialogContent>
</Dialog>
```

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Follow/unfollow functionality
- Activity feed updates
- Modal state management
- Real-time subscription handling

### **Integration Testing**

- Social interaction workflows
- Real-time update propagation
- Performance under load
- Error handling scenarios

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Direct messaging system
- Group creation and management
- Social challenges and competitions
- Content sharing to external platforms
- Advanced privacy controls

### **Performance Improvements**

- Virtual scrolling for large feeds
- Background sync for offline support
- Predictive content loading
- Enhanced caching strategies

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive social features  
**Next Review**: After direct messaging implementation
