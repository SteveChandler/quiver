# Skeleton Components Architecture

## 🎯 **PURPOSE**

The skeleton components provide loading state placeholders that maintain layout integrity while content loads, improving perceived performance and user experience.

## 📁 **COMPONENT STRUCTURE**

```
components/skeletons/
├── beach-card-skeleton.tsx     # Beach card loading states
├── buoy-conditions-skeleton.tsx # Buoy data loading states
└── map-skeleton.tsx            # Map interface loading states
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Layout Preservation Pattern**

```typescript
// Skeleton maintains exact layout of real component
SkeletonComponent
├── Same container dimensions
├── Placeholder elements matching real structure
├── Consistent spacing and proportions
└── Animated loading indicators
```

### **Reusable Skeleton System**

```typescript
// Base skeleton building blocks
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
  <div className="h-3 bg-gray-200 rounded w-1/2" />
</div>
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **BeachCardSkeleton** (Beach Loading States)

- **Purpose**: Loading placeholder for beach cards with multiple variants
- **Features**:
  - Single card skeleton
  - List skeleton with configurable count
  - Responsive grid layout matching real cards
  - Image, text, and metadata placeholders

**Implementation:**

```typescript
export function BeachCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="animate-pulse">
        {/* Image placeholder */}
        <div className="h-48 bg-gray-200" />

        {/* Content placeholders */}
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />

          {/* Rating placeholder */}
          <div className="flex items-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 w-4 bg-gray-200 rounded" />
            ))}
          </div>

          {/* Distance placeholder */}
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
    </Card>
  );
}

export function BeachCardListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <BeachCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

### **BuoyConditionsSkeleton** (Weather Loading States)

- **Purpose**: Loading placeholder for buoy condition cards
- **Features**:
  - Weather data placeholders
  - Measurement value placeholders
  - Status indicator placeholders
  - Responsive layout matching buoy cards

**Implementation:**

```typescript
export function BuoyConditionsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="animate-pulse">
          {/* Temperature placeholders */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-6 bg-gray-200 rounded w-12" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded w-12" />
              <div className="h-6 bg-gray-200 rounded w-10" />
            </div>
          </div>

          {/* Wind placeholder */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-10" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>

          {/* Wave placeholder */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### **MapSkeleton** (Map Loading States)

- **Purpose**: Loading placeholders for map interface components
- **Features**:
  - Map container placeholder
  - Beach card skeleton for selected beach
  - Nearby beach scroll skeleton
  - Search interface placeholders

**Implementation:**

```typescript
export function MapSkeleton() {
  return (
    <div className="h-full w-full bg-gray-200 animate-pulse flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 bg-gray-300 rounded-full mx-auto mb-4" />
        <div className="h-4 bg-gray-300 rounded w-32 mx-auto mb-2" />
        <div className="h-3 bg-gray-300 rounded w-24 mx-auto" />
      </div>
    </div>
  );
}

export function SelectedBeachCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-gray-200 rounded w-32" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>

        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>

        <div className="flex items-center space-x-4">
          <div className="h-8 bg-gray-200 rounded w-20" />
          <div className="h-8 bg-gray-200 rounded w-20" />
        </div>
      </div>
    </Card>
  );
}

export function NearbyBeachScrollSkeleton() {
  return (
    <div className="flex space-x-4 overflow-hidden">
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} className="flex-shrink-0 w-64">
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

## 🎨 **DESIGN PATTERNS**

### **Consistent Animation System**

```typescript
// Standard pulse animation across all skeletons
className = "animate-pulse";

// Gradient animation for smoother loading effect
const shimmerEffect = `
  relative overflow-hidden
  before:absolute before:inset-0
  before:-translate-x-full before:animate-[shimmer_2s_infinite]
  before:bg-gradient-to-r before:from-transparent
  before:via-white/60 before:to-transparent
`;
```

### **Proportional Placeholders**

```typescript
// Text placeholders with realistic proportions
<div className="space-y-2">
  <div className="h-4 bg-gray-200 rounded w-3/4" /> {/* Title */}
  <div className="h-3 bg-gray-200 rounded w-1/2" /> {/* Subtitle */}
  <div className="h-3 bg-gray-200 rounded w-2/3" /> {/* Description */}
</div>
```

### **Responsive Skeleton Grids**

```typescript
// Responsive skeleton layout matching real components
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {Array.from({ length: 6 }, (_, i) => (
    <BeachCardSkeleton key={i} />
  ))}
</div>
```

### **Loading State Hierarchy**

```typescript
// Different skeleton densities for different loading states
const skeletonVariants = {
  light: "bg-gray-100", // Subtle loading
  medium: "bg-gray-200", // Standard loading
  heavy: "bg-gray-300", // Prominent loading
};
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Efficient Rendering**

```typescript
// Memoized skeleton components
export const BeachCardSkeleton = memo(() => {
  return <Card className="overflow-hidden">{/* Skeleton content */}</Card>;
});

// Optimized list rendering
export function BeachCardListSkeleton({ count = 5 }: { count?: number }) {
  const skeletons = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => <BeachCardSkeleton key={i} />),
    [count]
  );

  return <div className="space-y-4">{skeletons}</div>;
}
```

### **CSS-Only Animations**

```typescript
// Pure CSS animations for better performance
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### **Reduced Bundle Impact**

```typescript
// Lightweight components with minimal dependencies
import { Card, CardContent, CardHeader } from "@/components/ui/card";
// No heavy imports or complex logic
```

## 🎯 **ACCESSIBILITY CONSIDERATIONS**

### **Screen Reader Support**

```typescript
// Proper ARIA labels for loading states
<div
  role="status"
  aria-label="Loading beach information"
  className="animate-pulse"
>
  <span className="sr-only">Loading...</span>
  {/* Skeleton content */}
</div>
```

### **Motion Preferences**

```typescript
// Respect reduced motion preferences
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
}
```

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Skeletons**

```typescript
// Maintain touch targets even in loading states
<div className="min-h-[44px] bg-gray-200 rounded" />
```

### **Mobile-Specific Layouts**

```typescript
// Responsive skeleton adjustments
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* Mobile: single column, larger screens: multi-column */}
</div>
```

## 🔄 **INTEGRATION PATTERNS**

### **Conditional Loading States**

```typescript
// Usage in parent components
{
  loading ? (
    <BeachCardListSkeleton count={beachCount} />
  ) : (
    <BeachCardList beaches={beaches} />
  );
}
```

### **Progressive Loading**

```typescript
// Show skeletons during incremental loading
{
  hasMore && isLoading && <BeachCardListSkeleton count={3} />;
}
```

### **Error State Integration**

```typescript
// Transition from skeleton to error state
{
  loading ? <Skeleton /> : error ? <ErrorState /> : <Content />;
}
```

## 🧪 **TESTING CONSIDERATIONS**

### **Visual Regression Testing**

- Skeleton layout consistency
- Animation smoothness
- Responsive behavior
- Accessibility compliance

### **Performance Testing**

- Animation performance impact
- Memory usage during loading
- Bundle size optimization

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Smart skeleton duration based on network speed
- Custom skeleton shapes for specific content types
- Progressive disclosure skeletons
- Skeleton themes for different app sections

### **Advanced Loading States**

- Intelligent skeleton content prediction
- Contextual loading messages
- Progress indicators integration
- Skeleton-to-content morphing animations

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive loading states  
**Next Review**: After smart skeleton duration implementation
