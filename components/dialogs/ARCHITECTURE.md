# Dialogs Directory Architecture

## Purpose

The `/components/dialogs` directory contains reusable dialog/modal components that can be used throughout the application. These components wrap Radix UI Dialog primitives with consistent styling, behavior, and integration with application features.

## Design Principles

### 1. Reusability First
Dialogs in this directory are designed to be reusable across multiple features and pages. Feature-specific dialogs should remain co-located with their features.

### 2. Composition Pattern
Dialogs compose smaller components (forms, content sections) rather than implementing logic directly. This maintains separation of concerns.

### 3. Controlled State
Dialogs accept `open` prop and callbacks rather than managing their own visibility. This gives parent components full control over dialog lifecycle.

### 4. Prevent Accidental Dismissal
Important dialogs (e.g., forms with unsaved changes) prevent accidental dismissal via:
- `onInteractOutside={(e) => e.preventDefault()}`
- `onEscapeKeyDown={(e) => e.preventDefault()}`

## Current Components

### ReviewPromptDialog

**File**: `review-prompt-dialog.tsx`

**Purpose**: Displays a post-session review prompt encouraging users to share their beach experience.

**Usage**:
```typescript
import { ReviewPromptDialog } from '@/components/dialogs/review-prompt-dialog';
import { useReviewPrompt } from '@/hooks/use-review-prompt';

const reviewPrompt = useReviewPrompt({
  onReviewSubmit: () => handleSuccess(),
  onDismiss: () => handleDismiss(),
});

<ReviewPromptDialog
  open={reviewPrompt.isOpen}
  reviewData={reviewPrompt.reviewData}
  onSuccess={reviewPrompt.handleSuccess}
  onSkip={() => reviewPrompt.handleSkip("skip")}
/>
```

**Features**:
- Integrates with `BeachReviewForm` component
- Prevents accidental dismissal during review
- Consistent UI with icon, title, description
- Skip button for users who don't want to review
- Automatic tracking via form component

**Hook Integration**: Designed to work seamlessly with `useReviewPrompt` hook.

## When to Add Dialogs Here

### Add to `/components/dialogs` if:
- Dialog will be used in 2+ different features/pages
- Dialog has complex state management that warrants a custom hook
- Dialog represents a common UX pattern (confirmation, prompt, form submission)

### Keep co-located with feature if:
- Dialog is only used in one specific feature
- Dialog contains feature-specific business logic
- Dialog is tightly coupled to a single page/component

## Common Patterns

### Pattern 1: Dialog + Custom Hook
For dialogs with complex state management:

```typescript
// hooks/use-my-dialog.ts
export function useMyDialog(options: Options) {
  const [isOpen, setIsOpen] = useState(false);
  // ... state management

  return {
    isOpen,
    show: () => setIsOpen(true),
    dismiss: () => setIsOpen(false),
    // ... other methods
  };
}

// components/dialogs/my-dialog.tsx
export function MyDialog({ open, onAction, onDismiss }: Props) {
  return (
    <Dialog open={open}>
      {/* dialog content */}
    </Dialog>
  );
}

// Usage in component
const myDialog = useMyDialog({ /* options */ });
<MyDialog
  open={myDialog.isOpen}
  onAction={myDialog.handleAction}
  onDismiss={myDialog.dismiss}
/>
```

### Pattern 2: Simple Controlled Dialog
For simpler dialogs without custom hooks:

```typescript
// components/dialogs/confirmation-dialog.tsx
export function ConfirmationDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p>{message}</p>
        <DialogFooter>
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Usage
const [open, setOpen] = useState(false);
<ConfirmationDialog
  open={open}
  title="Delete Session"
  message="Are you sure?"
  onConfirm={handleDelete}
  onCancel={() => setOpen(false)}
/>
```

## Testing Considerations

### Unit Tests
- Test dialog rendering with different prop combinations
- Test callback invocation
- Test keyboard navigation (Tab, Escape, Enter)
- Test accessibility attributes

### Integration Tests
- Test dialog opening/closing from parent component
- Test form submission within dialog
- Test data flow between parent and dialog

### E2E Tests (Playwright)
- Test complete user flows involving dialogs
- Test dialog dismissal behavior
- Test keyboard shortcuts
- Test mobile interactions

## Accessibility Requirements

All dialogs must meet these requirements:

1. **Keyboard Navigation**
   - Tab moves between interactive elements
   - Escape closes dialog (unless prevented)
   - Enter submits form (if applicable)

2. **Screen Reader Support**
   - Proper ARIA labels and roles
   - Focus management (trap focus in dialog)
   - Announce dialog opening

3. **Visual Indicators**
   - Focus visible on interactive elements
   - Clear hierarchy (title, content, actions)
   - Sufficient color contrast

4. **Mobile-Friendly**
   - Touch-friendly tap targets (44x44px minimum)
   - Scrollable content if needed
   - Responsive layout

## Related Documentation

- `/components/ui/dialog.tsx` - Base Dialog component (Radix UI wrapper)
- `/hooks/ARCHITECTURE.md` - Custom hooks patterns
- `/components/ARCHITECTURE.md` - Component architecture principles

## Future Considerations

### Potential Dialogs to Add
- Confirmation dialog (generic reusable)
- Share dialog (social sharing)
- Photo upload dialog
- Filter/search dialog
- Settings dialog

### Enhancements
- Dialog animation customization
- Size variants (sm, md, lg, xl, full)
- Position variants (center, bottom sheet, side panel)
- Stacking context management for nested dialogs
