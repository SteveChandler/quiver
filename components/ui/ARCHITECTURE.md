# UI Components Architecture

## 🎯 **PURPOSE**

The UI components provide a comprehensive design system built on Shadcn/ui with custom extensions for surf-specific features, ensuring consistent design language and accessibility across the application.

## 📁 **COMPONENT STRUCTURE**

```
components/ui/
├── Core Shadcn Components (40+ components)
│   ├── button.tsx, card.tsx, input.tsx, etc.
│   └── Standard form and layout components
├── Custom Form Components
│   ├── form-fields.tsx          # DRY form field components
│   └── form-layout.tsx          # Standardized form layouts
├── Surf-Specific Components
│   ├── forecast-preview.tsx     # Forecast data display
│   ├── wave-period-display.tsx  # Wave condition visualization
│   ├── tide-direction.tsx       # Tide status indicators
│   ├── tide-timing.tsx          # Tide timing information
│   └── star-rating.tsx          # Rating display component
├── Enhanced UI Components
│   ├── chart.tsx               # Enhanced Recharts integration
│   ├── loading-states.tsx      # Comprehensive loading system
│   └── forecast-data-transparency.tsx # Data source indicators
└── Utility Components
    ├── no-ssr.tsx              # SSR hydration safety
    └── use-mobile.tsx          # Mobile detection hook
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Layered Design System**

```typescript
DesignSystem
├── Base Layer (Shadcn/ui primitives)
├── Extension Layer (Custom form components)
├── Domain Layer (Surf-specific components)
└── Utility Layer (Helpers and hooks)
```

### **Composition Pattern**

```typescript
// Composable form components
<CardFormLayout title="Profile Information" form={form} onSubmit={handleSubmit}>
  <FormInput control={form.control} name="full_name" label="Full Name" />
  <FormTextarea control={form.control} name="bio" label="Bio" />
  <FormSelect control={form.control} name="location" options={locations} />
</CardFormLayout>
```

### **Variant System**

```typescript
// Consistent variant patterns across components
interface ComponentProps {
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}
```

## 📊 **COMPONENT CATEGORIES**

### **Core Shadcn Components** (Foundation)

- **Purpose**: Provide consistent base components with accessibility
- **Features**:
  - Full TypeScript support
  - Accessibility compliance (ARIA)
  - Consistent styling with CSS variables
  - Customizable via Tailwind CSS

**Key Components:**

```typescript
// Essential UI primitives
export { Button } from "./button";
export { Card, CardContent, CardHeader, CardTitle } from "./card";
export { Input } from "./input";
export { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
export { Form, FormField, FormItem, FormLabel, FormControl } from "./form";
```

### **Enhanced Form System** (DRY Components)

- **Purpose**: Eliminate form code duplication across the application
- **Features**:
  - Type-safe form field components
  - Consistent validation display
  - Standardized form layouts
  - React Hook Form integration

**FormFields Implementation:**

```typescript
interface BaseFormFieldProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  disabled,
  className,
}: FormInputProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              {...field}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

**Form Layout System:**

```typescript
export function CardFormLayout({
  title,
  description,
  form,
  onSubmit,
  children,
  className,
  headerActions,
}: CardFormLayoutProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {headerActions}
        </div>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            {children}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

### **Surf-Specific Components** (Domain Layer)

#### **WavePeriodDisplay** (Wave Conditions)

- **Purpose**: Visualize wave height, period, and direction
- **Features**:
  - Compact and detailed variants
  - Swell component breakdown
  - Quality assessment indicators
  - Direction compass integration

```typescript
export function WavePeriodDisplay({
  waveHeight,
  wavePeriod,
  waveDirection,
  variant = "compact",
  showDirection = true,
}: WavePeriodDisplayProps) {
  const formatPeriod = (period: string | null) => {
    if (!period) return "N/A";
    const numPeriod = parseFloat(period);
    return `${numPeriod}s`;
  };

  const getPeriodQuality = (period: string | null) => {
    if (!period) return { label: "Unknown", color: "text-gray-500" };
    const numPeriod = parseFloat(period);

    if (numPeriod >= 12) return { label: "Excellent", color: "text-green-600" };
    if (numPeriod >= 8) return { label: "Good", color: "text-blue-600" };
    if (numPeriod >= 6) return { label: "Fair", color: "text-yellow-600" };
    return { label: "Poor", color: "text-red-600" };
  };
}
```

#### **TideDirection & TideTiming** (Tide Information)

- **Purpose**: Display tide status and timing information
- **Features**:
  - Real-time tide direction indicators
  - Next tide countdown
  - Visual tide schedule
  - Compact and detailed variants

```typescript
export function TideDirection({
  status,
  currentHeight,
  variant = "compact",
}: TideDirectionProps) {
  const getTideInfo = (status: string) => {
    switch (status.toLowerCase()) {
      case "rising":
        return {
          icon: TrendingUp,
          color: "text-blue-600",
          bg: "bg-blue-50",
          label: "Rising",
        };
      case "falling":
        return {
          icon: TrendingDown,
          color: "text-red-600",
          bg: "bg-red-50",
          label: "Falling",
        };
      default:
        return {
          icon: Minus,
          color: "text-gray-600",
          bg: "bg-gray-50",
          label: "Stable",
        };
    }
  };
}
```

#### **StarRating** (Rating Display)

- **Purpose**: Consistent rating display across the application
- **Features**:
  - Multiple sizes (sm, md, lg)
  - Customizable colors
  - Number display option
  - Accessibility support

```typescript
export function StarRating({
  rating,
  maxStars = 5,
  size = "md",
  color = "text-yellow-500",
  showNumber = false,
  className = "",
}: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex">
        {Array.from({ length: maxStars }, (_, i) => (
          <Star
            key={i}
            className={cn(
              sizeClasses[size],
              i < Math.floor(rating) ? `${color} fill-current` : "text-gray-300"
            )}
          />
        ))}
      </div>
      {showNumber && (
        <span className="ml-1 text-sm text-muted-foreground">
          ({rating.toFixed(1)})
        </span>
      )}
    </div>
  );
}
```

### **Enhanced Chart System** (Data Visualization)

- **Purpose**: Surf-specific chart components with Recharts integration
- **Features**:
  - Tide chart visualization
  - Wave height timeline
  - Forecast confidence charts
  - Custom chart themes

```typescript
export const getTideChartConfig = (): ChartConfig => ({
  height: {
    label: "Tide Height",
    color: "hsl(var(--chart-1))",
  },
  time: {
    label: "Time",
    color: "hsl(var(--chart-2))",
  },
});

export function TideTooltipContent({
  active,
  payload,
  label,
  className,
}: TideTooltipContentProps) {
  if (!active || !payload?.length) return null;

  const formatTime = (time: Date | string | number) => {
    const date = new Date(time);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn("rounded-lg border bg-background p-2 shadow-sm", className)}
    >
      <div className="grid gap-2">
        <div className="flex flex-col">
          <span className="text-[0.70rem] uppercase text-muted-foreground">
            Time
          </span>
          <span className="font-bold text-muted-foreground">
            {formatTime(label)}
          </span>
        </div>
        {payload.map((entry, index) => (
          <div key={index} className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              {entry.name}
            </span>
            <span className="font-bold" style={{ color: entry.color }}>
              {entry.value}ft
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### **Loading States System** (Performance UX)

- **Purpose**: Comprehensive loading state management
- **Features**:
  - Multiple loading spinner variants
  - Skeleton components
  - Conditional loading wrappers
  - Performance-optimized animations

```typescript
export function LoadingSpinner({
  size = "md",
  className = "",
  text,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
      {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function WithLoading({
  loading,
  error,
  children,
  loadingComponent,
  errorComponent,
}: WithLoadingProps) {
  if (loading) {
    return loadingComponent || <CenteredLoadingSpinner />;
  }

  if (error) {
    return (
      errorComponent || (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
}
```

## 🎨 **DESIGN SYSTEM PRINCIPLES**

### **Consistent Spacing**

```typescript
// Standardized spacing scale
const spacing = {
  xs: "space-y-1", // 4px
  sm: "space-y-2", // 8px
  md: "space-y-4", // 16px
  lg: "space-y-6", // 24px
  xl: "space-y-8", // 32px
};
```

### **Color System**

```typescript
// CSS variables for theming
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --ocean-blue: 206 100% 50%;
  --surf-green: 142 71% 45%;
}

// Usage in components
className="bg-ocean-blue text-white"
className="text-surf-green"
```

### **Typography Scale**

```typescript
// Consistent text sizing
const textSizes = {
  xs: "text-xs", // 12px
  sm: "text-sm", // 14px
  base: "text-base", // 16px
  lg: "text-lg", // 18px
  xl: "text-xl", // 20px
  "2xl": "text-2xl", // 24px
};
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Bundle Size Management**

```typescript
// Tree-shakeable exports
export { Button } from "./button";
export { Card, CardContent, CardHeader } from "./card";
// Individual component imports prevent unused code

// Dynamic imports for heavy components
const Chart = lazy(() => import("./chart"));
```

### **CSS-in-JS Optimization**

```typescript
// Tailwind CSS with JIT compilation
// CSS variables for runtime theming
// Minimal runtime JavaScript for animations
```

### **Accessibility Performance**

```typescript
// Efficient ARIA implementations
<Button
  aria-label={ariaLabel}
  aria-describedby={description ? `${id}-description` : undefined}
  aria-pressed={isPressed}
>
  {children}
</Button>
```

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Sizing**

```typescript
// Minimum 44px touch targets
<Button size="lg" className="min-h-[44px] min-w-[44px]">

// Touch-optimized spacing
<div className="space-y-4 p-4"> // Adequate spacing for touch
```

### **Responsive Components**

```typescript
// Mobile-first responsive design
<Card className="w-full sm:max-w-md lg:max-w-lg">

// Conditional mobile layouts
{isMobile ? <MobileLayout /> : <DesktopLayout />}
```

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Accessibility compliance (ARIA, keyboard navigation)
- Visual regression testing
- Interaction testing (click, hover, focus)
- Responsive behavior validation

### **Design System Testing**

- Color contrast ratios
- Font size legibility
- Component consistency
- Theme switching functionality

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Dark mode theme system
- Advanced chart components
- Animation system with reduced motion support
- Design token management
- Component documentation site

### **Performance Improvements**

- CSS-in-JS migration evaluation
- Component lazy loading optimization
- Bundle splitting strategies
- Runtime performance monitoring

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive design system  
**Next Review**: After dark mode implementation
