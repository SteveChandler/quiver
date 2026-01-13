# Live Coast Pulse Intel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the horizontal LivePulseCarousel and enhance the vertical CoastPulse with community intel posts including emoji ratings, photos, and quick check-ins.

**Architecture:** Extend the existing intel system by adding an emoji_rating field and report functionality. Modify the CoastPulse component to display richer intel data with user level indicators. Add a quick check-in bottom sheet accessible from a "+" button in the header.

**Tech Stack:** Next.js 14, React 18, Supabase (PostgreSQL), Tailwind CSS, Radix UI, Zod validation

---

## Task 1: Database Migration - Add emoji_rating and intel_reports

**Files:**
- Create: `supabase/migrations/20260113120000_add_intel_emoji_and_reports.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Add emoji_rating to intel_posts and create intel_reports table
-- This enables community condition ratings and content reporting

BEGIN;

-- Add emoji_rating column to intel_posts
ALTER TABLE public.intel_posts
ADD COLUMN IF NOT EXISTS emoji_rating TEXT
CHECK (emoji_rating IN ('fire', 'shaka', 'meh', 'thumbsdown'));

-- Add report_count column to intel_posts for auto-hide threshold
ALTER TABLE public.intel_posts
ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0;

-- Create index for emoji_rating queries
CREATE INDEX IF NOT EXISTS idx_intel_posts_emoji_rating
ON public.intel_posts(emoji_rating)
WHERE emoji_rating IS NOT NULL;

-- Create intel_reports table
CREATE TABLE IF NOT EXISTS public.intel_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intel_post_id UUID NOT NULL REFERENCES public.intel_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(intel_post_id, user_id)
);

-- Create indexes for intel_reports
CREATE INDEX IF NOT EXISTS idx_intel_reports_post_id ON public.intel_reports(intel_post_id);
CREATE INDEX IF NOT EXISTS idx_intel_reports_user_id ON public.intel_reports(user_id);

-- Enable RLS on intel_reports
ALTER TABLE public.intel_reports ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can insert their own reports
CREATE POLICY "Users can report posts" ON public.intel_reports
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- RLS policy: Users can view their own reports
CREATE POLICY "Users can view own reports" ON public.intel_reports
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- RLS policy: Users can delete their own reports
CREATE POLICY "Users can delete own reports" ON public.intel_reports
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Trigger function to update report_count and auto-hide
CREATE OR REPLACE FUNCTION public.update_intel_report_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.intel_posts
        SET report_count = report_count + 1
        WHERE id = NEW.intel_post_id;

        -- Auto-hide posts with 3+ reports
        UPDATE public.intel_posts
        SET is_active = false
        WHERE id = NEW.intel_post_id AND report_count >= 3;

        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.intel_posts
        SET report_count = GREATEST(report_count - 1, 0)
        WHERE id = OLD.intel_post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for report count
DROP TRIGGER IF EXISTS intel_reports_count_trigger ON public.intel_reports;
CREATE TRIGGER intel_reports_count_trigger
    AFTER INSERT OR DELETE ON public.intel_reports
    FOR EACH ROW EXECUTE FUNCTION public.update_intel_report_count();

COMMIT;
```

**Step 2: Apply migration to remote database**

Run: `supabase db push`

Expected: Migration applied successfully

**Step 3: Verify migration**

Run: `supabase db diff`

Expected: No differences (migration fully applied)

**Step 4: Commit**

```bash
git add supabase/migrations/20260113120000_add_intel_emoji_and_reports.sql
git commit -m "feat(db): add emoji_rating and intel_reports for coast pulse intel"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/database.ts` (add emoji_rating and report types)

**Step 1: Add emoji rating type**

In `types/database.ts`, add after the existing `IntelPostTag` type:

```typescript
/**
 * Emoji rating options for intel posts
 * fire = excellent conditions
 * shaka = good conditions
 * meh = average conditions
 * thumbsdown = poor conditions
 */
export type IntelEmojiRating = 'fire' | 'shaka' | 'meh' | 'thumbsdown';
```

**Step 2: Update IntelPost interface**

Find the `IntelPost` or similar interface and add:

```typescript
emoji_rating?: IntelEmojiRating | null;
report_count?: number;
```

**Step 3: Add IntelReport type**

```typescript
export interface IntelReport {
  id: string;
  intel_post_id: string;
  user_id: string;
  reason?: string | null;
  created_at: string;
}
```

**Step 4: Regenerate types from Supabase**

Run: `yarn db:types`

Expected: Types regenerated with new columns

**Step 5: Commit**

```bash
git add types/
git commit -m "feat(types): add IntelEmojiRating and IntelReport types"
```

---

## Task 3: Update Validation Schema

**Files:**
- Modify: `lib/validation/schemas.ts:89-131`

**Step 1: Add emoji_rating to IntelPostCreateSchema**

Find `IntelPostCreateSchema` and add the emoji_rating field:

```typescript
export const IntelPostCreateSchema = z.object({
  latitude: z.number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  tag: z.enum(['parking', 'hazard', 'crowd', 'conditions', 'access', 'other']),
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .trim(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description cannot exceed 500 characters')
    .trim(),
  emoji_rating: z.enum(['fire', 'shaka', 'meh', 'thumbsdown']).optional(),
  // ... rest of existing fields
});
```

**Step 2: Add IntelReportSchema**

```typescript
export const IntelReportSchema = z.object({
  reason: z.string()
    .max(500, 'Reason cannot exceed 500 characters')
    .trim()
    .optional(),
});

export type IntelReportInput = z.infer<typeof IntelReportSchema>;
```

**Step 3: Commit**

```bash
git add lib/validation/schemas.ts
git commit -m "feat(validation): add emoji_rating to intel schema, add report schema"
```

---

## Task 4: Create Report API Endpoint

**Files:**
- Create: `app/api/intel/[id]/report/route.ts`
- Test: `__tests__/api/intel-report.test.ts`

**Step 1: Write the failing test**

Create `__tests__/api/intel-report.test.ts`:

```typescript
import { POST } from '@/app/api/intel/[id]/report/route';
import { NextRequest } from 'next/server';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
}));

describe('POST /api/intel/[id]/report', () => {
  it('should return 401 if user is not authenticated', async () => {
    const request = new NextRequest('http://localhost/api/intel/123/report', {
      method: 'POST',
      body: JSON.stringify({ reason: 'spam' }),
    });

    const response = await POST(request, { params: { id: '123' } });
    expect(response.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/api/intel-report.test.ts`

Expected: FAIL (module not found)

**Step 3: Write the report endpoint**

Create `app/api/intel/[id]/report/route.ts`:

```typescript
import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  createValidationError,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { parseAndValidateJson } from "@/lib/validation/middleware";
import { IntelReportSchema } from "@/lib/validation/schemas";
import { validateOrError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/[id]/report
 * Report an intel post for review
 */
export const POST = withAuth(
  async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    // Validate UUID parameter
    const uuidResult = validateUuidParam(params.id, "intel");
    if ("error" in uuidResult) return uuidResult.error;
    const intelPostId = uuidResult.value;

    // Parse and validate request body (reason is optional)
    let reason: string | undefined;
    try {
      const parseResult = await parseAndValidateJson(request);
      if (!("error" in parseResult)) {
        const validationResult = validateOrError(IntelReportSchema, parseResult.data);
        if (!("error" in validationResult)) {
          reason = validationResult.data.reason;
        }
      }
    } catch {
      // Body parsing failed, continue without reason
    }

    // Check if intel post exists and is active
    const { data: intelPost, error: postError } = await supabase
      .from("intel_posts")
      .select("id, user_id, is_active")
      .eq("id", intelPostId)
      .single();

    if (postError || !intelPost) {
      return createNotFoundError("Intel post");
    }

    // Prevent users from reporting their own posts
    if (intelPost.user_id === user.id) {
      return createValidationError("You cannot report your own post");
    }

    // Check if user has already reported this post
    const { data: existingReport } = await supabase
      .from("intel_reports")
      .select("id")
      .eq("intel_post_id", intelPostId)
      .eq("user_id", user.id)
      .single();

    if (existingReport) {
      return createValidationError("You have already reported this post");
    }

    // Create the report
    const { error: reportError } = await supabase
      .from("intel_reports")
      .insert({
        intel_post_id: intelPostId,
        user_id: user.id,
        reason,
      });

    if (reportError) {
      console.error("Error creating report:", reportError);
      throw reportError;
    }

    return createSuccessResponse({
      reported: true,
      message: "Thank you for your report. We'll review this post.",
    });
  },
  { errorMessage: "Failed to report intel post" }
);
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/api/intel-report.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/api/intel/[id]/report/route.ts __tests__/api/intel-report.test.ts
git commit -m "feat(api): add POST /api/intel/[id]/report endpoint"
```

---

## Task 5: Update Intel POST API to Accept emoji_rating

**Files:**
- Modify: `app/api/intel/route.ts:336-354`

**Step 1: Update the insert to include emoji_rating**

Find the insert statement in `app/api/intel/route.ts` around line 336 and add `emoji_rating`:

```typescript
// Create intel post
const { data: intelPost, error: createError } = await writeClient
  .from("intel_posts")
  .insert({
    user_id: user.id,
    latitude,
    longitude,
    tag,
    title: sanitizedTitle,
    description: sanitizedDescription,
    photo_url,
    photo_storage_path,
    emoji_rating, // ADD THIS LINE
    expires_at: expiryDate.toISOString(),
    dedupe_hash: dedupeHash,
    surf_conditions: Object.keys(surfConditions).length
      ? surfConditions
      : null,
  })
  .select()
  .single();
```

**Step 2: Extract emoji_rating from validated data**

Around line 223, add `emoji_rating` to the destructured validation result:

```typescript
const {
  latitude,
  longitude,
  tag,
  title,
  description,
  photo_url,
  photo_storage_path,
  emoji_rating, // ADD THIS LINE
  wave_height,
  // ... rest of fields
} = validationResult.data;
```

**Step 3: Commit**

```bash
git add app/api/intel/route.ts
git commit -m "feat(api): accept emoji_rating in POST /api/intel"
```

---

## Task 6: Delete LivePulseCarousel Component

**Files:**
- Delete: `components/dashboard/live-pulse-carousel.tsx`
- Delete: `lib/utils/coast-pulse-transforms.ts`

**Step 1: Remove the LivePulseCarousel file**

Run: `rm components/dashboard/live-pulse-carousel.tsx`

**Step 2: Remove the transforms utility (only used by carousel)**

Run: `rm lib/utils/coast-pulse-transforms.ts`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove LivePulseCarousel component and transforms"
```

---

## Task 7: Remove LivePulseCarousel from HomeScreen

**Files:**
- Modify: `components/home-screen/index.tsx`

**Step 1: Remove imports**

Delete these lines (around lines 21-23):

```typescript
// DELETE THESE LINES:
import { LivePulseCarousel } from "../dashboard/live-pulse-carousel";
import { transformToLivePulseItems } from "@/lib/utils/coast-pulse-transforms";
```

**Step 2: Remove coastPulseData fetch and transform**

Delete or comment out lines 81-99:

```typescript
// DELETE THIS BLOCK:
// Fetch coast pulse data for LivePulseCarousel
const { data: coastPulseData } = useDataFetcher(
  async () => {
    const { lat, lon } = coastPulseCoords;
    const res = await fetch(`/api/coast-pulse?lat=${lat}&lon=${lon}&limit=12`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  },
  {
    skip: !profile,
    initialData: null,
  }
);

// Transform coast pulse items for carousel
const livePulseItems = coastPulseData?.items
  ? transformToLivePulseItems(coastPulseData.items)
  : [];
```

**Step 3: Remove LivePulseCarousel JSX**

Delete lines 272-277:

```typescript
// DELETE THIS SECTION:
{/* 5. Live Pulse Carousel - horizontal scrolling cards */}
{profile && livePulseItems.length > 0 && (
  <section className="centered-container px-4 sm:px-0">
    <LivePulseCarousel data={livePulseItems} />
  </section>
)}
```

**Step 4: Verify build passes**

Run: `yarn build`

Expected: Build succeeds without errors

**Step 5: Commit**

```bash
git add components/home-screen/index.tsx
git commit -m "refactor: remove LivePulseCarousel from home screen"
```

---

## Task 8: Create Emoji Picker Component

**Files:**
- Create: `components/intel/emoji-picker.tsx`

**Step 1: Create the emoji picker component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { IntelEmojiRating } from "@/types/database";

interface EmojiPickerProps {
  value?: IntelEmojiRating | null;
  onChange: (rating: IntelEmojiRating) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const EMOJI_OPTIONS: { value: IntelEmojiRating; emoji: string; label: string }[] = [
  { value: "fire", emoji: "🔥", label: "Fire" },
  { value: "shaka", emoji: "🤙", label: "Shaka" },
  { value: "meh", emoji: "😐", label: "Meh" },
  { value: "thumbsdown", emoji: "👎", label: "Nah" },
];

const SIZE_CLASSES = {
  sm: "text-xl p-2 min-w-[44px]",
  md: "text-2xl p-3 min-w-[56px]",
  lg: "text-3xl p-4 min-w-[68px]",
};

/**
 * EmojiPicker - Select a condition rating using emojis
 *
 * @example
 * ```tsx
 * <EmojiPicker value={rating} onChange={setRating} />
 * ```
 */
export function EmojiPicker({
  value,
  onChange,
  disabled = false,
  size = "md"
}: EmojiPickerProps) {
  return (
    <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Condition rating">
      {EMOJI_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.label}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl transition-all duration-200",
            "hover:bg-white/10 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
            SIZE_CLASSES[size],
            value === option.value
              ? "bg-white/20 ring-2 ring-white/40 scale-110"
              : "bg-white/5",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="block">{option.emoji}</span>
          <span className="text-[10px] text-gray-400 mt-0.5 block">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Display an emoji rating (read-only)
 */
export function EmojiRatingDisplay({ rating, size = "sm" }: { rating: IntelEmojiRating; size?: "sm" | "md" }) {
  const option = EMOJI_OPTIONS.find((o) => o.value === rating);
  if (!option) return null;

  return (
    <span
      className={cn("inline-block", size === "sm" ? "text-lg" : "text-xl")}
      title={option.label}
    >
      {option.emoji}
    </span>
  );
}

export { EMOJI_OPTIONS };
export default EmojiPicker;
```

**Step 2: Commit**

```bash
git add components/intel/emoji-picker.tsx
git commit -m "feat(ui): add EmojiPicker component for condition ratings"
```

---

## Task 9: Create Quick Check-in Bottom Sheet

**Files:**
- Create: `components/intel/quick-checkin-sheet.tsx`

**Step 1: Create the bottom sheet component**

```typescript
"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, MapPin, Loader2, X } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";
import { toast } from "sonner";
import { uploadImage } from "@/lib/image-upload";
import { useGeolocation } from "@/hooks/use-geolocation";
import type { IntelEmojiRating } from "@/types/database";
import Image from "next/image";

interface QuickCheckinSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nearestBeachName?: string;
  onSuccess?: () => void;
}

/**
 * QuickCheckinSheet - Bottom sheet for quick intel check-ins
 *
 * @example
 * ```tsx
 * <QuickCheckinSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   nearestBeachName="La Jolla Shores"
 * />
 * ```
 */
export function QuickCheckinSheet({
  open,
  onOpenChange,
  nearestBeachName,
  onSuccess,
}: QuickCheckinSheetProps) {
  const [rating, setRating] = useState<IntelEmojiRating | null>(null);
  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { coords } = useGeolocation({ autoRequest: false });

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be less than 5MB");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
  }, [photoPreview]);

  const handleSubmit = useCallback(async () => {
    if (!rating) {
      toast.error("Please select a condition rating");
      return;
    }

    if (!coords) {
      toast.error("Location required. Please enable location services.");
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo if present
      let photoUrl: string | undefined;
      let photoStoragePath: string | undefined;

      if (photoFile) {
        const uploadResult = await uploadImage(photoFile, "intel-photos");
        if (uploadResult.error) {
          throw new Error(uploadResult.error);
        }
        photoUrl = uploadResult.url;
        photoStoragePath = uploadResult.path;
      }

      // Create intel post
      const response = await fetch("/api/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lon,
          tag: "conditions",
          title: `Quick check-in: ${rating}`,
          description: note || `Conditions rated ${rating}`,
          emoji_rating: rating,
          photo_url: photoUrl,
          photo_storage_path: photoStoragePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to post check-in");
      }

      toast.success("Check-in posted!");

      // Reset form
      setRating(null);
      setNote("");
      clearPhoto();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to post check-in");
    } finally {
      setSubmitting(false);
    }
  }, [rating, note, photoFile, coords, clearPhoto, onOpenChange, onSuccess]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#1e1e1e] border-t border-white/10 rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white">Quick Check-in</SheetTitle>
          <SheetDescription className="text-gray-400">
            Share current conditions with the community
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Emoji Rating (required) */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              How&apos;s it looking?
            </label>
            <EmojiPicker value={rating} onChange={setRating} />
          </div>

          {/* Optional Note */}
          <div>
            <Textarea
              placeholder="Add a note (optional)..."
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 140))}
              maxLength={140}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{note.length}/140</p>
          </div>

          {/* Photo & Location Row */}
          <div className="flex items-center justify-between">
            {/* Photo Upload */}
            <div className="flex items-center gap-2">
              {photoPreview ? (
                <div className="relative">
                  <Image
                    src={photoPreview}
                    alt="Preview"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                  <Camera className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Add photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </label>
              )}
            </div>

            {/* Location Indicator */}
            <div className="flex items-center gap-1.5 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="truncate max-w-[120px]">
                {nearestBeachName || (coords ? "Location detected" : "No location")}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!rating || submitting}
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Check-in"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default QuickCheckinSheet;
```

**Step 2: Commit**

```bash
git add components/intel/quick-checkin-sheet.tsx
git commit -m "feat(ui): add QuickCheckinSheet for fast intel posts"
```

---

## Task 10: Create Photo Modal Component

**Files:**
- Create: `components/intel/photo-modal.tsx`

**Step 1: Create the photo modal**

```typescript
"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import Image from "next/image";

interface PhotoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoUrl: string;
  caption?: string;
  authorName?: string;
}

/**
 * PhotoModal - Full-screen photo viewer with swipe-to-dismiss
 */
export function PhotoModal({
  open,
  onOpenChange,
  photoUrl,
  caption,
  authorName,
}: PhotoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black/95 border-none">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Image */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={photoUrl}
            alt={caption || "Intel photo"}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 80vw"
          />
        </div>

        {/* Caption & Author */}
        {(caption || authorName) && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            {authorName && (
              <p className="text-sm text-gray-300 mb-1">@{authorName}</p>
            )}
            {caption && (
              <p className="text-white">{caption}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PhotoModal;
```

**Step 2: Commit**

```bash
git add components/intel/photo-modal.tsx
git commit -m "feat(ui): add PhotoModal for full-screen intel photos"
```

---

## Task 11: Enhance CoastPulse Component

**Files:**
- Modify: `components/dashboard/coast-pulse.tsx`

This is the largest task. We need to:
1. Add "+" button in header
2. Display intel posts with emoji ratings
3. Show user level rings
4. Add photo thumbnails
5. Add vote/report controls

**Step 1: Add imports at the top of the file**

```typescript
import { Plus, MoreVertical, Flag, ThumbsUp } from "lucide-react";
import { useState, useCallback } from "react";
import { QuickCheckinSheet } from "../intel/quick-checkin-sheet";
import { PhotoModal } from "../intel/photo-modal";
import { EmojiRatingDisplay } from "../intel/emoji-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
```

**Step 2: Add state for modals inside the component**

After the existing state declarations, add:

```typescript
const [checkinOpen, setCheckinOpen] = useState(false);
const [photoModal, setPhotoModal] = useState<{ open: boolean; url: string; caption?: string } | null>(null);
```

**Step 3: Add report handler**

```typescript
const handleReport = useCallback(async (postId: string) => {
  try {
    const response = await fetch(`/api/intel/${postId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Inappropriate content" }),
    });

    if (response.ok) {
      toast.success("Report submitted. Thank you!");
    } else {
      const error = await response.json();
      toast.error(error.message || "Failed to report");
    }
  } catch {
    toast.error("Failed to report post");
  }
}, []);
```

**Step 4: Update the header to include "+" button**

Replace the header div (around line 237-251) with:

```typescript
{/* Header with Live indicator and Add button */}
<div className="flex items-center justify-between">
  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
    <Activity className="text-[#f97316]" size={16} />
    Live Coast Pulse
  </h3>
  <div className="flex items-center gap-2">
    {/* Add Check-in Button */}
    <button
      onClick={() => setCheckinOpen(true)}
      className="w-7 h-7 rounded-full bg-[#f97316] hover:bg-[#ea580c] flex items-center justify-center transition-colors"
      aria-label="Add check-in"
    >
      <Plus className="w-4 h-4 text-white" />
    </button>
    {/* Live Indicator */}
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative h-2 w-2 rounded-full bg-green-500" />
      </span>
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
        Live
      </span>
    </span>
  </div>
</div>
```

**Step 5: Update the timeline item rendering to handle intel posts with emoji ratings**

In the items.map section, enhance the content rendering to detect intel posts and show emoji/photo:

```typescript
{/* Content */}
<div className="space-y-1">
  {/* Source line with badge */}
  <div className="flex items-center gap-2">
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.colorClass}`}
    >
      {config.icon}
      {config.label}
    </span>
    <p className="text-xs font-medium text-gray-400 truncate max-w-[180px]">
      {item.source.name}
    </p>

    {/* Overflow menu for intel items */}
    {item.source.type === "intel" && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="ml-auto p-1 hover:bg-white/10 rounded">
            <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#2a2a2a] border-white/10">
          <DropdownMenuItem
            onClick={() => handleReport(item.id.replace("intel-", ""))}
            className="text-red-400 focus:text-red-400"
          >
            <Flag className="w-3.5 h-3.5 mr-2" />
            Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>

  {/* Message with emoji rating if present */}
  <div className="flex items-start gap-2">
    {(item as any).emoji_rating && (
      <EmojiRatingDisplay rating={(item as any).emoji_rating} />
    )}
    <p className="text-sm text-white leading-snug flex-1">
      {item.message}
    </p>
    {item.trend && getTrendIcon(item.trend)}
  </div>

  {/* Photo thumbnail */}
  {item.photoUrl && (
    <button
      onClick={() => setPhotoModal({ open: true, url: item.photoUrl!, caption: item.message })}
      className="mt-2"
    >
      <img
        src={item.photoUrl}
        alt="Intel photo"
        className="w-12 h-12 rounded-lg object-cover hover:opacity-80 transition-opacity"
      />
    </button>
  )}

  {/* Timestamp and distance */}
  <div className="flex items-center gap-2 text-[10px] text-gray-500">
    <span>{formatTimeAgo(new Date(item.timestamp))}</span>
    {item.location && item.location.distanceKm > 0 && (
      <>
        <span>·</span>
        <span>{Math.round(item.location.distanceKm * 0.621371)} mi away</span>
      </>
    )}
  </div>
</div>
```

**Step 6: Add modals at the end of the component JSX (before closing div)**

```typescript
{/* Quick Check-in Sheet */}
<QuickCheckinSheet
  open={checkinOpen}
  onOpenChange={setCheckinOpen}
  onSuccess={fetchData}
/>

{/* Photo Modal */}
{photoModal && (
  <PhotoModal
    open={photoModal.open}
    onOpenChange={(open) => setPhotoModal(open ? photoModal : null)}
    photoUrl={photoModal.url}
    caption={photoModal.caption}
  />
)}
```

**Step 7: Verify build**

Run: `yarn build`

Expected: Build succeeds

**Step 8: Commit**

```bash
git add components/dashboard/coast-pulse.tsx
git commit -m "feat(coast-pulse): add intel posting, emoji ratings, photos, and reporting"
```

---

## Task 12: Update Coast Pulse API to Include Intel with Emoji Ratings

**Files:**
- Modify: `app/api/coast-pulse/route.ts`

**Step 1: Update fetchRecentIntel to include emoji_rating**

Find the `fetchRecentIntel` function (around line 526) and update the select to include emoji_rating:

```typescript
const { data: posts } = await supabase
  .from("intel_posts")
  .select(
    `
    id,
    title,
    description,
    emoji_rating,
    created_at,
    photo_url,
    confirmations_count,
    user_id,
    beach:beaches(id, name, lat, lon)
  `
  )
  .eq("is_active", true)
  .gte("created_at", twentyFourHoursAgo)
  .order("created_at", { ascending: false })
  .limit(10);
```

**Step 2: Update the return mapping to include emoji_rating**

```typescript
return nearbyPosts.slice(0, 5).map((post: any) => ({
  id: `intel-${post.id}`,
  source: {
    name: post.beach?.name || "Local Beach",
    type: "intel" as const,
    credibility: 50 + Math.min(post.confirmations_count || 0, 20) * 2, // Boost credibility with confirmations
  },
  message: post.description || post.title,
  timestamp: new Date(post.created_at),
  location: post.beach
    ? {
        lat: post.beach.lat,
        lon: post.beach.lon,
        distanceKm: haversineDistance(lat, lon, post.beach.lat, post.beach.lon),
      }
    : undefined,
  photoUrl: post.photo_url || undefined,
  emoji_rating: post.emoji_rating || undefined,
}));
```

**Step 3: Update CoastPulseItem interface to include emoji_rating**

At the top of the file (around line 43), add to the interface:

```typescript
interface CoastPulseItem {
  id: string;
  source: CoastPulseSource;
  message: string;
  timestamp: Date;
  location?: {
    lat: number;
    lon: number;
    distanceKm: number;
  };
  trend?: "up" | "down" | "stable";
  photoUrl?: string;
  emoji_rating?: "fire" | "shaka" | "meh" | "thumbsdown"; // ADD THIS LINE
}
```

**Step 4: Commit**

```bash
git add app/api/coast-pulse/route.ts
git commit -m "feat(api): include emoji_rating in coast-pulse intel items"
```

---

## Task 13: Add E2E Tests for Intel Features

**Files:**
- Create: `e2e/coast-pulse-intel.spec.ts`

**Step 1: Create E2E test file**

```typescript
import { test, expect } from '@playwright/test';
import { waitForPageLoad } from './utils/test-helpers';
import { TIMEOUTS } from './fixtures/test-data';
import {
  setupErrorDetection,
  assertNoErrors,
  gotoWithErrorCheck,
  ErrorCapture,
} from './utils/error-detection';

/**
 * Coast Pulse Intel Tests
 * Tests the intel posting and display features in Coast Pulse
 *
 * @project auth
 */

test.describe('Coast Pulse Intel Features', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    await gotoWithErrorCheck(page, errorCapture, '/');
    await waitForPageLoad(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Test cleanup' });
  });

  test.describe('Coast Pulse Section', () => {
    test('should display coast pulse section with add button @smoke', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Check for add button in header
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await expect(addButton).toBeVisible();
    });

    test('should open quick check-in sheet when clicking add button', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Click add button
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Check for bottom sheet
      const sheet = page.locator('text=Quick Check-in');
      await expect(sheet).toBeVisible({ timeout: TIMEOUTS.short });
    });

    test('should display emoji picker in quick check-in sheet', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Check for emoji options
      const fireEmoji = page.locator('button[aria-label="Fire"]');
      const shakaEmoji = page.locator('button[aria-label="Shaka"]');

      await expect(fireEmoji).toBeVisible();
      await expect(shakaEmoji).toBeVisible();
    });

    test('should require emoji selection before posting', async ({ page }) => {
      const coastPulse = page.locator('[data-testid="coast-pulse-section"]');
      await expect(coastPulse).toBeVisible({ timeout: TIMEOUTS.medium });

      // Open sheet
      const addButton = coastPulse.locator('button[aria-label="Add check-in"]');
      await addButton.click();

      // Try to submit without selection
      const submitButton = page.locator('button:has-text("Post Check-in")');
      await expect(submitButton).toBeDisabled();
    });
  });
});
```

**Step 2: Run E2E tests**

Run: `yarn test:e2e e2e/coast-pulse-intel.spec.ts`

Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/coast-pulse-intel.spec.ts
git commit -m "test(e2e): add Coast Pulse intel feature tests"
```

---

## Task 14: Final Verification and Cleanup

**Step 1: Run full build**

Run: `yarn build`

Expected: Build succeeds with no errors

**Step 2: Run all E2E tests**

Run: `yarn test:e2e`

Expected: All tests pass

**Step 3: Run type check**

Run: `yarn typecheck`

Expected: No type errors

**Step 4: Final commit with all changes**

```bash
git add -A
git status
```

Verify all expected files are staged, then:

```bash
git commit -m "feat: complete Live Coast Pulse intel integration

- Remove horizontal LivePulseCarousel
- Add emoji ratings (fire/shaka/meh/thumbsdown) to intel posts
- Add quick check-in bottom sheet with photo upload
- Add photo modal for full-screen viewing
- Add report functionality for content moderation
- Update CoastPulse component with enhanced intel display
- Add E2E tests for new features

Closes #XXX"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/20260113120000_*.sql` |
| 2 | TypeScript types | `types/database.ts` |
| 3 | Validation schema | `lib/validation/schemas.ts` |
| 4 | Report API endpoint | `app/api/intel/[id]/report/route.ts` |
| 5 | Update intel POST API | `app/api/intel/route.ts` |
| 6 | Delete carousel component | `components/dashboard/live-pulse-carousel.tsx` |
| 7 | Remove from home screen | `components/home-screen/index.tsx` |
| 8 | Emoji picker component | `components/intel/emoji-picker.tsx` |
| 9 | Quick check-in sheet | `components/intel/quick-checkin-sheet.tsx` |
| 10 | Photo modal component | `components/intel/photo-modal.tsx` |
| 11 | Enhance CoastPulse | `components/dashboard/coast-pulse.tsx` |
| 12 | Update coast-pulse API | `app/api/coast-pulse/route.ts` |
| 13 | E2E tests | `e2e/coast-pulse-intel.spec.ts` |
| 14 | Final verification | - |
