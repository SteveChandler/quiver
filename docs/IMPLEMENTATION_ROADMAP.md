# 🚀 Phase 2B Implementation Roadmap

## Quiver Surf App - Next 6 Weeks Development Plan

### 📊 Current Status: Phase 2A Social Features 70% Complete

**Major Achievements:**

- ✅ Session likes/comments system fully functional
- ✅ Architecture completely optimized (no performance issues)
- ✅ Community feed with real-time interactions
- ✅ Solid foundation with established patterns

**Next Priority:** Complete remaining Phase 2 features for full community experience

---

## 🎯 **WEEK 1-2: MEDIA SYSTEM COMPLETION**

### **Priority 1: Supabase Storage Integration**

#### Supabase Storage Configuration

```typescript
// lib/supabase/storage.ts - NEW FILE
import { supabase } from "@/lib/supabase/client";
import { compress } from "image-conversion";

const STORAGE_BUCKET = "session-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per image (free tier consideration)
const MAX_IMAGES_PER_SESSION = 5; // Limit for free tier

export async function uploadSessionPhoto(
  file: File,
  sessionId: string,
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Compress image for free tier storage optimization
    const compressedFile = await compress(file, {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      type: "image/jpeg",
    });

    if (compressedFile.size > MAX_FILE_SIZE) {
      throw new Error("File size too large. Please choose a smaller image.");
    }

    const fileExt = "jpg";
    const fileName = `${sessionId}/${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, compressedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function uploadMultiplePhotos(
  files: File[],
  sessionId: string,
  userId: string
): Promise<UploadResult[]> {
  if (files.length > MAX_IMAGES_PER_SESSION) {
    throw new Error(
      `Maximum ${MAX_IMAGES_PER_SESSION} images allowed per session`
    );
  }

  const results = await Promise.all(
    files.map((file) => uploadSessionPhoto(file, sessionId, userId))
  );

  return results;
}

export async function deleteSessionPhoto(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}
```

#### Database Schema Extensions

```sql
-- Add session media table
CREATE TABLE session_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  media_type VARCHAR(20) CHECK (media_type IN ('photo', 'video')) DEFAULT 'photo',
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  file_size INTEGER, -- Track for free tier monitoring
  metadata JSONB, -- dimensions, compression ratio, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add storage usage tracking for free tier management
CREATE TABLE storage_usage (
  user_id UUID PRIMARY KEY REFERENCES profiles(id),
  total_bytes BIGINT DEFAULT 0,
  image_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE session_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all session media"
ON session_media FOR SELECT USING (true);

CREATE POLICY "Users can insert their own session media"
ON session_media FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session media"
ON session_media FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own storage usage"
ON storage_usage FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own storage usage"
ON storage_usage FOR ALL USING (auth.uid() = user_id);

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-media', 'session-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Users can upload their own session media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'session-media' AND auth.uid()::text = (storage.foldername(name))[2]);

CREATE POLICY "Anyone can view session media"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-media');

CREATE POLICY "Users can delete their own session media"
ON storage.objects FOR DELETE
USING (bucket_id = 'session-media' AND auth.uid()::text = (storage.foldername(name))[2]);
```

#### Components to Build

```typescript
// components/media/session-photo-upload.tsx - NEW
interface SessionPhotoUploadProps {
  sessionId: string;
  onUploadComplete: (urls: string[]) => void;
  maxPhotos?: number;
}

// components/media/session-photo-gallery.tsx - NEW
interface SessionPhotoGalleryProps {
  sessionId: string;
  photos: SessionPhoto[];
  canEdit?: boolean;
}

// components/media/photo-compression.tsx - NEW
// Handles image compression and optimization for free tier
```

### **Priority 2: Session Logging Integration**

#### Update Session Form

```typescript
// Modify components/session-forms/log-session-form.tsx
// Add photo upload step in form wizard
// Include photo selection and upload progress
// Update session creation to handle media relationships
```

### **Acceptance Criteria Week 1-2:**

- [ ] Supabase Storage fully configured and tested
- [ ] Photo upload during session logging works
- [ ] Session photo galleries display correctly
- [ ] Image compression ratio > 50%
- [ ] Storage usage stays within free tier limits
- [ ] Session media galleries load < 2 seconds

---

## 🎯 **WEEK 2-3: BEACH REVIEWS SYSTEM**

### **Priority 1: Database Schema**

```sql
-- Beach reviews table
CREATE TABLE beach_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID REFERENCES beaches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  wave_quality INTEGER CHECK (wave_quality >= 1 AND wave_quality <= 5),
  crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5),
  amenities INTEGER CHECK (amenities >= 1 AND amenities <= 5),
  parking INTEGER CHECK (parking >= 1 AND parking <= 5),
  comment TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Review helpfulness tracking
CREATE TABLE review_helpfulness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES beach_reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

-- Add RLS policies
ALTER TABLE beach_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpfulness ENABLE ROW LEVEL SECURITY;

-- Policies for beach_reviews
CREATE POLICY "Anyone can view beach reviews"
ON beach_reviews FOR SELECT USING (true);

CREATE POLICY "Users can insert their own reviews"
ON beach_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON beach_reviews FOR UPDATE USING (auth.uid() = user_id);

-- Policies for review_helpfulness
CREATE POLICY "Anyone can view review helpfulness"
ON review_helpfulness FOR SELECT USING (true);

CREATE POLICY "Users can manage their own helpfulness votes"
ON review_helpfulness FOR ALL USING (auth.uid() = user_id);
```

### **Priority 2: Server Actions**

```typescript
// actions/beach-review-actions.ts - NEW FILE
export async function createBeachReview(
  reviewData: BeachReviewData
): Promise<ActionResult>;
export async function updateBeachReview(
  reviewId: string,
  updates: Partial<BeachReviewData>
): Promise<ActionResult>;
export async function deleteBeachReview(
  reviewId: string
): Promise<ActionResult>;
export async function markReviewHelpful(
  reviewId: string,
  isHelpful: boolean
): Promise<ActionResult>;
export async function getBeachReviews(
  beachId: string,
  limit?: number
): Promise<BeachReview[]>;
```

### **Priority 3: UI Components**

```typescript
// components/beach-detail/beach-review-form.tsx - NEW
interface BeachReviewFormProps {
  beachId: string;
  existingReview?: BeachReview;
  onSuccess: (review: BeachReview) => void;
}

// components/beach-detail/beach-reviews-list.tsx - NEW
interface BeachReviewsListProps {
  beachId: string;
  reviews: BeachReview[];
  currentUserId?: string;
}

// components/beach-detail/review-card.tsx - NEW
interface ReviewCardProps {
  review: BeachReview;
  canEdit?: boolean;
  showHelpfulness?: boolean;
}
```

### **Priority 4: Beach Detail Integration**

```typescript
// Update components/beach-detail-view.tsx
// Add reviews section with:
// - Review summary statistics
// - "Write a Review" button
// - Reviews list with pagination
// - Review filtering and sorting options
```

### **Acceptance Criteria Week 2-3:**

- [ ] Beach review database schema implemented
- [ ] Beach review form functional with all rating categories
- [ ] Reviews display in beach detail pages with proper formatting
- [ ] Review helpfulness voting works
- [ ] Review aggregation and statistics display correctly
- [ ] Users can edit/delete their own reviews

---

## 🎯 **WEEK 3-4: REAL-TIME FEATURES**

### **Priority 1: Live Condition Reporting**

#### Database Schema

```sql
-- Live condition reports table
CREATE TABLE condition_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id UUID REFERENCES beaches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  wave_height_ft DECIMAL(3,1),
  wave_quality INTEGER CHECK (wave_quality >= 1 AND wave_quality <= 5),
  wind_direction VARCHAR(10), -- N, NE, E, SE, S, SW, W, NW
  wind_speed_mph INTEGER,
  crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5),
  water_temp_f INTEGER,
  parking_availability INTEGER CHECK (parking_availability >= 1 AND parking_availability <= 5),
  hazards TEXT[], -- Array of hazard descriptions
  notes TEXT,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '6 hours'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE condition_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view current condition reports"
ON condition_reports FOR SELECT USING (expires_at > NOW());

CREATE POLICY "Users can insert condition reports"
ON condition_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Components

```typescript
// components/conditions/condition-report-form.tsx - NEW
interface ConditionReportFormProps {
  beachId: string;
  onSuccess: (report: ConditionReport) => void;
}

// components/conditions/live-conditions-widget.tsx - NEW
interface LiveConditionsWidgetProps {
  beachId: string;
  showReportButton?: boolean;
}

// components/conditions/condition-timeline.tsx - NEW
interface ConditionTimelineProps {
  beachId: string;
  reports: ConditionReport[];
}
```

### **Priority 2: Push Notifications Setup**

#### Service Worker

```typescript
// public/sw.js - NEW FILE
// Handle push notifications for condition alerts
// Background sync for offline functionality
```

#### Notification System

```typescript
// lib/notifications/push-service.ts - NEW FILE
export async function requestNotificationPermission(): Promise<boolean>;
export async function subscribeToConditionAlerts(
  beachIds: string[]
): Promise<void>;
export async function sendConditionAlert(
  beachId: string,
  conditions: ConditionData
): Promise<void>;
```

### **Acceptance Criteria Week 3-4:**

- [ ] Live condition reporting form functional
- [ ] Real-time condition updates display on beach pages
- [ ] Push notification service worker installed
- [ ] Users can subscribe to condition alerts for favorite beaches
- [ ] Condition reports automatically expire after 6 hours
- [ ] Real-time condition data updates via Supabase subscriptions

---

## 🎯 **WEEK 4-6: ADVANCED SOCIAL FEATURES**

### **Priority 1: Friend/Follow System**

#### Database Schema

```sql
-- User follows table
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Add RLS policies
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all follows"
ON user_follows FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows"
ON user_follows FOR ALL USING (auth.uid() = follower_id);
```

#### Components

```typescript
// components/social/follow-button.tsx - NEW
interface FollowButtonProps {
  userId: string;
  initialFollowState?: boolean;
}

// components/social/followers-modal.tsx - NEW
interface FollowersModalProps {
  userId: string;
  type: "followers" | "following";
}

// components/social/activity-feed.tsx - NEW
interface ActivityFeedProps {
  userId?: string; // If provided, show user's activity; otherwise show following feed
  limit?: number;
}
```

### **Priority 2: Activity Feed System**

#### Database Schema

```sql
-- Activity feed table
CREATE TABLE user_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'session_logged', 'session_liked', 'beach_reviewed', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'session', 'beach_review', etc.
  entity_id UUID NOT NULL,
  metadata JSONB, -- Additional activity context
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_user_activities_user_id_created_at ON user_activities(user_id, created_at DESC);
CREATE INDEX idx_user_activities_type_created_at ON user_activities(activity_type, created_at DESC);
```

### **Priority 3: Session Invitations**

#### Database Schema

```sql
-- Session invitations table
CREATE TABLE session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES profiles(id),
  invitee_id UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Acceptance Criteria Week 4-6:**

- [ ] Follow/unfollow functionality works with real-time updates
- [ ] Activity feed shows relevant actions from followed users
- [ ] Session invitation system allows users to invite friends
- [ ] Push notifications for social interactions (follows, invites, etc.)
- [ ] User profile pages show follower/following counts
- [ ] Activity feed pagination and infinite scroll

---

## 🔧 **TECHNICAL REQUIREMENTS**

### **Environment Setup**

```bash
# Supabase configuration (already configured)
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **Dependencies to Add**

```json
{
  "image-conversion": "^2.1.1",
  "@types/file-saver": "^2.0.5",
  "file-saver": "^2.0.5"
}
```

### **Free Tier Considerations**

- **Storage Limit**: 1GB total storage
- **Bandwidth**: 2GB egress per month
- **Image Optimization**: Compress all images to 80% quality
- **File Size Limits**: 5MB maximum per image
- **Session Limits**: Maximum 5 images per session
- **Monitoring**: Track user storage usage
- **Cleanup**: Implement automated cleanup of old media

### **Testing Requirements**

- [ ] Unit tests for all new server actions
- [ ] Integration tests for media upload pipeline
- [ ] E2E tests for review and condition reporting flows
- [ ] Performance tests for real-time subscriptions
- [ ] Push notification testing across browsers

---

## 📊 **SUCCESS METRICS & VALIDATION**

### **Week 1-2 Metrics (Media System)**

- Photo upload success rate > 95%
- Average upload time < 15 seconds (with compression)
- Image compression ratio > 50%
- Storage usage stays within free tier limits
- Session media galleries load < 2 seconds

### **Week 2-3 Metrics (Beach Reviews)**

- Beach review submission success rate > 98%
- Review aggregation accuracy 100%
- Beach detail page load time with reviews < 3 seconds

### **Week 3-4 Metrics (Real-Time Features)**

- Condition report submission success rate > 95%
- Real-time update delivery < 2 seconds
- Push notification delivery rate > 90%

### **Week 4-6 Metrics (Social Features)**

- Follow/unfollow success rate > 99%
- Activity feed load time < 2 seconds
- Session invitation delivery rate > 95%

---

## 🚨 **CRITICAL SUCCESS FACTORS**

### **Must Maintain:**

- Zero performance regressions
- All existing social features continue working
- Mobile-first responsive design
- Real-time functionality remains stable

### **Quality Gates:**

- [ ] All new features have comprehensive tests
- [ ] Database migrations are reversible
- [ ] Error handling follows established patterns
- [ ] Components follow design system standards
- [ ] API responses use standardized formats

### **Architecture Compliance:**

- [ ] Use `useDataFetcher` for all data fetching
- [ ] Server actions use authentication wrappers
- [ ] Real-time features use Supabase subscriptions
- [ ] Components follow established patterns
- [ ] All database changes include RLS policies

---

## 📅 **MILESTONE DELIVERIES**

### **End of Week 2:** Media System Complete

- Supabase Storage integrated and functional
- Session photo upload working
- Photo galleries displaying correctly

### **End of Week 3:** Beach Reviews Live

- Beach review system fully functional
- Reviews displaying in beach detail pages
- Review aggregation and statistics working

### **End of Week 4:** Real-Time Features Active

- Live condition reporting functional
- Push notifications configured
- Real-time updates working across app

### **End of Week 6:** Phase 2B Complete

- Friend/follow system operational
- Activity feeds functional
- Session invitations working
- All social features integrated

---

## 🎯 **POST-COMPLETION: PHASE 3 PREPARATION**

### **Advanced Features Roadmap:**

- AI-powered wave prediction
- Advanced analytics dashboard
- Monetization features (premium subscriptions)
- Advanced gamification system
- Multi-language support
- Offline-first capabilities

### **Success Celebration:**

🎉 **Phase 2B Completion = Full Community Surf App**

- Complete social ecosystem
- Rich media sharing
- Real-time community data
- Advanced user engagement features

---

_**Next Review**: End of Week 6 (Phase 2B Completion)_  
_**Document Owner**: Development Team_  
_**Last Updated**: December 2024_
