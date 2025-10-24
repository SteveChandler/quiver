# Quiver Onboarding Implementation Plan (Revised)

**Date**: 2025-10-23
**Status**: Ready for Implementation
**Architecture**: shadcn/ui + react-hook-form + zod + Zustand + Onborda

---

## Architecture Decision

Following best practices for Next.js onboarding:

| **Component** | **Use Case** | **Library** |
|---------------|--------------|-------------|
| **Forms & Validation** | Data collection with validation | `react-hook-form` + `zod` |
| **Modal Container** | Stepper wizard dialog | shadcn/ui `Dialog` or `Sheet` |
| **Wizard Steps** | Custom stepper component | Radix primitives |
| **State Management** | Cross-step state persistence | `Zustand` |
| **Product Tour** | Feature education after setup | `Onborda` |

### Decision Rules

- **"Collect data or validate?"** → RHF + zod in Dialog/Sheet
- **"Multi-step setup before usage?"** → Stepper wizard
- **"Explain existing UI?"** → Onborda tour

---

## Installation

```bash
npm i onborda react-hook-form zod zustand @hookform/resolvers
```

---

## User Flow

```
1. New user signs up
   ↓
2. Multi-step Dialog Wizard (shadcn Dialog + custom Stepper)
   Step 1: Welcome → No form
   Step 2: Profile → RHF+zod (name, display name)
   Step 3: Home Beach → RHF+zod (beach selection)
   Step 4: Preferences → RHF+zod (experience, styles)
   Step 5: Referral → RHF+zod (optional code)
   Step 6: Notifications → RHF+zod (push opt-in)
   Step 7: Completion → Show XP earned, invite prompt
   ↓
3. Dialog closes → Zustand persists completion
   ↓
4. User sees personalized home page
   ↓
5. Onborda Product Tour launches (if not dismissed)
   - Highlights map, home beach widget, XP, sessions, etc.
   ↓
6. Fully onboarded
```

---

## Implementation

### 1. Zustand Store (State Management)

**File**: `/store/onboarding-store.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingData {
  // Step 2: Profile
  fullName?: string;
  displayName?: string;

  // Step 3: Home Beach
  homeBeachId?: string;
  homeBeachName?: string;

  // Step 4: Preferences
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  surfStyles?: string[];

  // Step 5: Referral
  referralCode?: string;

  // Step 6: Notifications
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

interface OnboardingStore {
  // State
  currentStep: number;
  isOpen: boolean;
  data: OnboardingData;
  isCompleted: boolean;

  // Actions
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateData: (partial: Partial<OnboardingData>) => void;
  openDialog: () => void;
  closeDialog: () => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStep: 0,
      isOpen: false,
      data: {},
      isCompleted: false,

      // Actions
      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => set((state) => ({
        currentStep: Math.min(state.currentStep + 1, 6)
      })),

      prevStep: () => set((state) => ({
        currentStep: Math.max(state.currentStep - 1, 0)
      })),

      updateData: (partial) => set((state) => ({
        data: { ...state.data, ...partial }
      })),

      openDialog: () => set({ isOpen: true }),

      closeDialog: () => set({ isOpen: false }),

      completeOnboarding: () => set({
        isCompleted: true,
        isOpen: false
      }),

      reset: () => set({
        currentStep: 0,
        isOpen: false,
        data: {},
        isCompleted: false
      }),
    }),
    {
      name: 'quiver-onboarding',
      partialize: (state) => ({
        currentStep: state.currentStep,
        data: state.data,
        isCompleted: state.isCompleted,
      }),
    }
  )
);
```

---

### 2. Zod Schemas (Validation)

**File**: `/lib/schemas/onboarding-schemas.ts`

```typescript
import { z } from 'zod';

// Step 2: Profile
export const profileSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters'),
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(30, 'Display name must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// Step 3: Home Beach
export const homeBeachSchema = z.object({
  homeBeachId: z.string().min(1, 'Please select a beach'),
  homeBeachName: z.string().min(1),
});

export type HomeBeachFormData = z.infer<typeof homeBeachSchema>;

// Step 4: Preferences
export const preferencesSchema = z.object({
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert'], {
    required_error: 'Please select your experience level',
  }),
  surfStyles: z.array(z.string()).min(1, 'Select at least one style'),
});

export type PreferencesFormData = z.infer<typeof preferencesSchema>;

// Step 5: Referral (optional)
export const referralSchema = z.object({
  referralCode: z.string().optional(),
});

export type ReferralFormData = z.infer<typeof referralSchema>;

// Step 6: Notifications
export const notificationsSchema = z.object({
  pushEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(true),
});

export type NotificationsFormData = z.infer<typeof notificationsSchema>;
```

---

### 3. Custom Stepper Component

**File**: `/components/onboarding/stepper.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
}

export function Stepper({ currentStep, totalSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i <= currentStep ? 'bg-ocean-blue' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}
```

---

### 4. Step Components with React Hook Form

**File**: `/components/onboarding/steps/profile-step.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ProfileStep() {
  const { data, updateData, nextStep } = useOnboardingStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: data.fullName || '',
      displayName: data.displayName || '',
    },
    mode: 'onChange',
  });

  const onSubmit = (formData: ProfileFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">What's your name?</h2>
        <p className="text-gray-600 text-sm">
          Let the community know who you are
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            placeholder="e.g., Sarah Johnson"
            {...register('fullName')}
            aria-invalid={!!errors.fullName}
          />
          {errors.fullName && (
            <p className="text-sm text-red-600 mt-1" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            placeholder="e.g., WaveRider"
            {...register('displayName')}
            aria-invalid={!!errors.displayName}
          />
          {errors.displayName && (
            <p className="text-sm text-red-600 mt-1" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!isValid}>
        Continue
      </Button>
    </form>
  );
}
```

**File**: `/components/onboarding/steps/home-beach-step.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { homeBeachSchema, HomeBeachFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

export function HomeBeachStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedBeach, setSelectedBeach] = useState<any>(null);

  const {
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<HomeBeachFormData>({
    resolver: zodResolver(homeBeachSchema),
    defaultValues: {
      homeBeachId: data.homeBeachId || '',
      homeBeachName: data.homeBeachName || '',
    },
  });

  const searchBeaches = async (query: string) => {
    if (query.length < 2) return;
    // Call API to search beaches
    const res = await fetch(`/api/beaches/search?q=${query}`);
    const beaches = await res.json();
    setSearchResults(beaches);
  };

  const selectBeach = (beach: any) => {
    setSelectedBeach(beach);
    setValue('homeBeachId', beach.id, { shouldValidate: true });
    setValue('homeBeachName', beach.name, { shouldValidate: true });
    setSearchResults([]);
  };

  const onSubmit = (formData: HomeBeachFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Where do you usually surf?</h2>
        <p className="text-gray-600 text-sm">
          We'll show you personalized forecasts for your home beach
        </p>
      </div>

      <div>
        <Label htmlFor="beachSearch">Search for your beach</Label>
        <div className="relative">
          <Input
            id="beachSearch"
            placeholder="e.g., Malibu, Pipeline, Rincon..."
            onChange={(e) => searchBeaches(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((beach) => (
                <button
                  key={beach.id}
                  type="button"
                  onClick={() => selectBeach(beach)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                >
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">{beach.name}</div>
                    <div className="text-sm text-gray-500">{beach.region}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedBeach && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <MapPin className="h-4 w-4 text-ocean-blue" />
            <span className="font-medium">{selectedBeach.name}</span>
          </div>
        )}
        {errors.homeBeachId && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.homeBeachId.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
```

**File**: `/components/onboarding/steps/preferences-step.tsx`

```typescript
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { preferencesSchema, PreferencesFormData } from '@/lib/schemas/onboarding-schemas';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const EXPERIENCE_LEVELS = [
  { value: 'beginner', label: 'Beginner', emoji: '🏄‍♂️' },
  { value: 'intermediate', label: 'Intermediate', emoji: '🌊' },
  { value: 'advanced', label: 'Advanced', emoji: '🏆' },
  { value: 'expert', label: 'Expert', emoji: '🔥' },
];

const SURF_STYLES = [
  { value: 'longboard', label: 'Longboard', emoji: '🏄' },
  { value: 'shortboard', label: 'Shortboard', emoji: '🏄‍♀️' },
  { value: 'funboard', label: 'Funboard', emoji: '🏄‍♂️' },
  { value: 'bodyboard', label: 'Bodyboard', emoji: '🏊' },
];

export function PreferencesStep() {
  const { data, updateData, nextStep, prevStep } = useOnboardingStore();

  const { handleSubmit, control, formState: { errors, isValid } } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      experienceLevel: data.experienceLevel,
      surfStyles: data.surfStyles || [],
    },
  });

  const onSubmit = (formData: PreferencesFormData) => {
    updateData(formData);
    nextStep();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tell us about your surfing</h2>
        <p className="text-gray-600 text-sm">
          Help us personalize your experience
        </p>
      </div>

      {/* Experience Level */}
      <div>
        <Label>Experience Level</Label>
        <Controller
          name="experienceLevel"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => field.onChange(level.value)}
                  className={cn(
                    'p-4 border-2 rounded-lg text-center transition-all',
                    field.value === level.value
                      ? 'border-ocean-blue bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="text-3xl mb-1">{level.emoji}</div>
                  <div className="font-medium text-sm">{level.label}</div>
                </button>
              ))}
            </div>
          )}
        />
        {errors.experienceLevel && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.experienceLevel.message}
          </p>
        )}
      </div>

      {/* Surf Styles */}
      <div>
        <Label>Surf Styles (select all that apply)</Label>
        <Controller
          name="surfStyles"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {SURF_STYLES.map((style) => {
                const isSelected = field.value?.includes(style.value);
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => {
                      const current = field.value || [];
                      const updated = isSelected
                        ? current.filter((v) => v !== style.value)
                        : [...current, style.value];
                      field.onChange(updated);
                    }}
                    className={cn(
                      'p-4 border-2 rounded-lg text-center transition-all',
                      isSelected
                        ? 'border-ocean-blue bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="text-3xl mb-1">{style.emoji}</div>
                    <div className="font-medium text-sm">{style.label}</div>
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.surfStyles && (
          <p className="text-sm text-red-600 mt-1" role="alert">
            {errors.surfStyles.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={prevStep} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={!isValid}>
          Continue
        </Button>
      </div>
    </form>
  );
}
```

---

### 5. Main Onboarding Dialog

**File**: `/components/onboarding/onboarding-dialog.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useOnboardingStore } from '@/store/onboarding-store';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Stepper } from './stepper';
import { WelcomeStep } from './steps/welcome-step';
import { ProfileStep } from './steps/profile-step';
import { HomeBeachStep } from './steps/home-beach-step';
import { PreferencesStep } from './steps/preferences-step';
import { ReferralStep } from './steps/referral-step';
import { NotificationsStep } from './steps/notifications-step';
import { CompletionStep } from './steps/completion-step';

const STEPS = [
  WelcomeStep,
  ProfileStep,
  HomeBeachStep,
  PreferencesStep,
  ReferralStep,
  NotificationsStep,
  CompletionStep,
];

export function OnboardingDialog() {
  const { isOpen, currentStep, isCompleted, openDialog } = useOnboardingStore();

  useEffect(() => {
    // Auto-open for new users
    const shouldShow = !isCompleted && !localStorage.getItem('onboarding_dismissed');
    if (shouldShow) {
      openDialog();
    }
  }, [isCompleted, openDialog]);

  const CurrentStepComponent = STEPS[currentStep];

  return (
    <Dialog open={isOpen && !isCompleted}>
      <DialogContent className="max-w-lg" hideClose>
        <div className="p-6">
          <Stepper currentStep={currentStep} totalSteps={STEPS.length} />
          <CurrentStepComponent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 6. Onborda Product Tour (After Onboarding)

**File**: `/components/onboarding/product-tour.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { Onborda, OnbordaProvider, Step } from 'onborda';
import { useOnboardingStore } from '@/store/onboarding-store';

const TOUR_STEPS: Step[] = [
  {
    icon: '🗺️',
    title: 'Forecast Map',
    content: 'Explore surf conditions at beaches near you.',
    selector: '#forecast-map',
    side: 'bottom',
    showControls: true,
  },
  {
    icon: '🏠',
    title: 'Your Home Beach',
    content: 'Quick access to your home beach forecast.',
    selector: '#home-beach-widget',
    side: 'bottom',
    showControls: true,
  },
  {
    icon: '⭐',
    title: 'XP & Achievements',
    content: 'Track your progress and unlock achievements!',
    selector: '#gamification-widget',
    side: 'left',
    showControls: true,
  },
];

export function ProductTour() {
  const { isCompleted } = useOnboardingStore();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (isCompleted && !localStorage.getItem('tour_completed')) {
      // Delay to let modal close
      setTimeout(() => setShowTour(true), 500);
    }
  }, [isCompleted]);

  const handleTourComplete = () => {
    localStorage.setItem('tour_completed', 'true');
    setShowTour(false);
  };

  return (
    <OnbordaProvider>
      <Onborda
        steps={TOUR_STEPS}
        showOnborda={showTour}
        onComplete={handleTourComplete}
      >
        {({ step }) => (
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm">
            <div className="text-4xl mb-3">{step.icon}</div>
            <h3 className="text-lg font-bold mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600">{step.content}</p>
          </div>
        )}
      </Onborda>
    </OnbordaProvider>
  );
}
```

---

### 7. Server Action (Save to Database)

**File**: `/actions/onboarding-actions.ts`

```typescript
'use server';

import { withAuthenticatedAction } from '@/lib/server-action-utils';
import { track } from '@/lib/analytics';

export async function saveOnboardingData(data: any) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.fullName,
        display_name: data.displayName,
        home_beach_id: data.homeBeachId,
        experience_level: data.experienceLevel,
        surf_styles: data.surfStyles,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) throw error;

    track('onboarding_completed', { user_id: user.id });

    return { success: true };
  });
}
```

---

## Summary

**Architecture**:
1. **Zustand** = Global state (current step, form data, completion status)
2. **react-hook-form + zod** = Per-step validation
3. **shadcn Dialog** = Modal container
4. **Custom Stepper** = Progress indicator
5. **Onborda** = Post-onboarding UI tour

**Benefits**:
- ✅ Proper separation: Forms ≠ Tours
- ✅ Type-safe with Zod schemas
- ✅ Persisted state (localStorage via Zustand)
- ✅ Accessible (RHF handles ARIA)
- ✅ Testable (each step isolated)
- ✅ Scalable (easy to add/remove steps)

**Estimated Effort**: 3-4 days for full implementation

---

## Next Steps

1. [ ] Install dependencies
2. [ ] Create Zustand store
3. [ ] Create Zod schemas for each step
4. [ ] Build step components with RHF
5. [ ] Build main dialog wrapper
6. [ ] Configure Onborda tour
7. [ ] Test end-to-end flow
8. [ ] Deploy
