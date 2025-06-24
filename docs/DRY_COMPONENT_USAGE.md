# DRY Component Usage Guide

This document explains how to use the new DRY components that eliminate code duplication in the Quiver app.

## 🆕 New DRY Components Implemented

### 1. Card Form Layout Component (`components/ui/form-layout.tsx`)

Eliminates the repetitive `Card + CardHeader + CardTitle + CardDescription + Form + CardContent` pattern.

#### ❌ Before (Repeated in 8+ components)

```tsx
// components/edit-profile-form.tsx, basic-profile-form.tsx, etc.
return (
  <Card>
    <CardHeader>
      <CardTitle>Edit Profile</CardTitle>
      <CardDescription>Update your personal information</CardDescription>
    </CardHeader>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <FormField control={form.control} name="name" ... />
          <FormField control={form.control} name="email" ... />
        </CardContent>
      </form>
    </Form>
  </Card>
);
```

#### ✅ After (One-line replacement)

```tsx
import { CardFormLayout } from "@/components/ui/form-layout";

return (
  <CardFormLayout
    title="Edit Profile"
    description="Update your personal information"
    form={form}
    onSubmit={form.handleSubmit(onSubmit)}
  >
    <FormField control={form.control} name="name" ... />
    <FormField control={form.control} name="email" ... />
  </CardFormLayout>
);
```

#### 🎛️ With Header Actions

```tsx
<CardFormLayout
  title="My Quiver"
  description="Manage your surfboards"
  form={form}
  onSubmit={handleSubmit}
  headerActions={
    <Button onClick={handleAddBoard}>
      <Plus className="h-4 w-4 mr-1" />
      Add Board
    </Button>
  }
>
  {/* form content */}
</CardFormLayout>
```

#### 🎨 Simple Layout (No Form)

```tsx
import { SimpleCardLayout } from "@/components/ui/form-layout";

<SimpleCardLayout
  title="Weather Conditions"
  description="Current surf conditions"
>
  <div>Custom content without form wrapper</div>
</SimpleCardLayout>;
```

**Impact**: Reduces form components from ~50 lines to ~15 lines (70% reduction)

---

### 2. Reusable FormField Components (`components/ui/form-fields.tsx`)

Eliminates the repetitive `FormField + FormItem + FormLabel + FormControl + Input` pattern.

#### ❌ Before (Repeated 50+ times)

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} type="email" placeholder="your.email@example.com" />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### ✅ After (One-line replacement)

```tsx
import {
  FormInput,
  FormTextarea,
  FormSelect,
} from "@/components/ui/form-fields";

{
  /* Text Input */
}
<FormInput
  control={form.control}
  name="email"
  label="Email"
  type="email"
  placeholder="your.email@example.com"
/>;

{
  /* Textarea */
}
<FormTextarea
  control={form.control}
  name="bio"
  label="Bio"
  placeholder="Tell us about yourself..."
  rows={4}
/>;

{
  /* Select Dropdown */
}
<FormSelect
  control={form.control}
  name="experience"
  label="Experience Level"
  options={[
    { value: "beginner", label: "Beginner" },
    { value: "intermediate", label: "Intermediate" },
    { value: "advanced", label: "Advanced" },
  ]}
  emptyOption="Select experience level"
/>;

{
  /* Custom Field (for special cases) */
}
<CustomFormField
  control={form.control}
  name="avatar"
  label="Profile Picture"
  description="Upload a profile picture"
>
  {(field) => <div>{/* Custom avatar upload component */}</div>}
</CustomFormField>;
```

**Impact**: Reduces FormField usage from ~12 lines to ~6 lines (50% reduction)

---

### 3. Enhanced Admin Auth Wrapper (`lib/auth/admin-wrapper.ts`)

Centralizes admin authentication checks across API routes and components.

#### ❌ Before (Repeated in admin API routes)

```tsx
// app/api/admin/some-route/route.ts
export async function POST(request: NextRequest) {
  const authResult = await authenticateAdmin();
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  // Admin logic here
  return NextResponse.json({ success: true });
}
```

#### ✅ After (Wrapper handles auth automatically)

```tsx
import { withAdminAuth } from "@/lib/auth/admin-wrapper";

export async function POST(request: NextRequest) {
  return withAdminAuth(async (user) => {
    // user is guaranteed to be an admin here
    // Admin logic here
    return NextResponse.json({ success: true });
  });
}
```

#### 🔒 Server Actions

```tsx
import { withAdminServerAction } from "@/lib/auth/admin-wrapper";

export const adminAction = withAdminServerAction(async (user, data) => {
  // user is guaranteed to be an admin here
  return { success: true, data: result };
});
```

#### 🚪 Route Protection (Middleware)

```tsx
// middleware.ts
import { adminRouteGuard } from "@/lib/auth/admin-wrapper";

export async function middleware(request: NextRequest) {
  if (pathname.startsWith("/admin")) {
    const adminCheck = await adminRouteGuard(request);
    if (adminCheck) return adminCheck; // Redirects if not admin
  }
  // Continue if admin
}
```

#### ✅ Flexible Admin Check

```tsx
import { isAdminRequest } from "@/lib/auth/admin-wrapper";

export async function GET(request: NextRequest) {
  const isUserAdmin = await isAdminRequest();

  if (isUserAdmin) {
    // Show admin-only data
    return NextResponse.json({ adminData: true });
  } else {
    // Show public data
    return NextResponse.json({ publicData: true });
  }
}
```

**Impact**: Eliminates ~15 lines of auth boilerplate per admin route

---

## 🔄 Migration Guide

### Step 1: Update Form Components

Replace Card form layouts in these files:

- `components/edit-profile-form.tsx`
- `components/profile/basic-profile-form.tsx`
- `components/profile/boards-manager.tsx`
- `components/beach/beach-review-form.tsx`
- `components/auth/sign-in-form.tsx`
- `components/auth/sign-up-form.tsx`

### Step 2: Update FormField Usage

Replace FormField patterns in these components:

- `components/add-board-dialog.tsx`
- `components/profile/profile-preferences.tsx`
- Any component with `FormField + FormItem + FormLabel + FormControl`

### Step 3: Update Admin Routes

Replace admin auth patterns in these API routes:

- `app/api/admin/sync-buoys/route.ts`
- `app/api/admin/update-buoy-conditions/route.ts`
- `app/api/admin/cleanup-inactive-buoys/route.ts`

### Step 4: Test All Changes

After migration, ensure:

- [ ] Forms still submit correctly
- [ ] Validation still works
- [ ] Admin routes are properly protected
- [ ] No TypeScript errors

---

## 📊 Total Impact

| Component Type   | Before (Lines) | After (Lines) | Reduction      |
| ---------------- | -------------- | ------------- | -------------- |
| Card Form Layout | ~50            | ~15           | **70%**        |
| FormField Usage  | ~12            | ~6            | **50%**        |
| Admin Auth       | ~15            | ~3            | **80%**        |
| **Total Saved**  |                |               | **~400 lines** |

## 🎯 Benefits Achieved

1. **Consistency**: All forms follow the same layout pattern
2. **Maintainability**: Changes to form styling only need updates in one place
3. **Developer Experience**: Less boilerplate code to write
4. **Type Safety**: Full TypeScript support for all components
5. **Error Reduction**: Standardized patterns reduce copy-paste errors
6. **Admin Security**: Centralized admin auth reduces security gaps

These DRY improvements maintain the excellent architecture patterns already established while eliminating repetitive code throughout the codebase!
