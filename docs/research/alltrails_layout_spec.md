# Technical Specification: AllTrails Trail Page Layout

**Status**: Reference Document - Design System Analysis  
**Last Updated**: January 2025  
**Implementation Status**: ✅ **Design System Adopted** - Core design tokens implemented via Tailwind CSS

## Implementation Status Summary

### ✅ Implemented Design Tokens
- **Typography**: Inter, Roboto, Open Sans font families (via `tailwind.config.ts`)
- **Colors**: Ocean blue (#0077B6), sunset orange (#FF7F11) - semantic color system
- **Spacing**: 4px base unit system (matches 8px base in practice via Tailwind scale)
- **Border Radius**: Consistent radius system via CSS variables (`--radius: 0.5rem`)
- **Layout Containers**: Max-width 1280px containers implemented (`home-container` class)
- **Breakpoints**: Mobile-first responsive design (sm, md, lg, xl breakpoints)

### 🔶 Partially Implemented
- **Component Specifications**: Many components exist but may differ from exact AllTrails specs
- **Two-Pane Layout**: Map + list view exists but not as `/explore` route with split pane

### ❌ Not Yet Implemented (As Specified)
- Exact AllTrails component layouts (adapted for surf context instead)
- Weather widget gradient design
- Elevation profile (not applicable to surf)
- Some interactive states match Tailwind defaults vs. custom specs

## Global Design System

### Typography Scale
```
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-heading: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;

--text-xs: 12px / line-height: 16px / letter-spacing: 0.02em
--text-sm: 14px / line-height: 20px / letter-spacing: 0.01em
--text-base: 16px / line-height: 24px / letter-spacing: 0
--text-lg: 18px / line-height: 28px / letter-spacing: -0.01em
--text-xl: 20px / line-height: 30px / letter-spacing: -0.01em
--text-2xl: 24px / line-height: 32px / letter-spacing: -0.02em
--text-3xl: 30px / line-height: 38px / letter-spacing: -0.02em
--text-4xl: 36px / line-height: 44px / letter-spacing: -0.03em
```

### Color Palette (Quiver)
```
--color-primary: #0077B6 (ocean-blue)
--color-primary-hover: #006699
--color-secondary: #0891b2 (cyan-600)
--color-accent: #FF7F11 (sunset-orange)
--color-danger: #E74C3C
--color-success: #27AE60

--gray-50: #FAFAFA
--gray-100: #F5F5F5
--gray-200: #E5E5E5
--gray-300: #D4D4D4
--gray-400: #A3A3A3
--gray-500: #737373
--gray-600: #525252
--gray-700: #404040
--gray-800: #262626
--gray-900: #171717

--border-radius-sm: 4px
--border-radius-md: 8px
--border-radius-lg: 12px
--border-radius-xl: 16px
--border-radius-full: 9999px
```

### Spacing System (8px base)
```
--spacing-0: 0px
--spacing-1: 4px
--spacing-2: 8px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-7: 28px
--spacing-8: 32px
--spacing-10: 40px
--spacing-12: 48px
--spacing-14: 56px
--spacing-16: 64px
--spacing-20: 80px
```

## Layout Structure

### Container Specifications
```
Max-width: 1280px
Padding-x (desktop): 24px
Padding-x (tablet): 20px
Padding-x (mobile): 16px
Main content column (desktop): 66.67% (853px at max-width)
Sidebar column (desktop): 33.33% (427px at max-width)
Gap between columns: 32px
```

## Component Specifications

### 1. Header Section
```
Container:
- Background: white
- Padding: 24px 0
- Border-bottom: 1px solid var(--gray-200)

Trail Name:
- Font-size: 36px
- Font-weight: 700
- Line-height: 44px
- Color: var(--gray-900)
- Margin-bottom: 8px

Location Breadcrumb:
- Font-size: 14px
- Color: var(--gray-600)
- Separator: " › " (chevron)
- Link color: var(--color-primary) (#0077B6)
- Link hover: underline

Status Badge:
- Display: inline-flex
- Padding: 4px 12px
- Border-radius: 20px
- Font-size: 12px
- Font-weight: 600
- Background (open): #E0F2FE (cyan-50)
- Color (open): #0891b2 (cyan-600)
- Margin-left: 12px
```

### 2. Rating Component
```
Container:
- Display: flex
- Align-items: center
- Gap: 8px
- Margin: 12px 0

Star Icons:
- Size: 20px × 20px
- Filled color: #FFC107
- Empty color: var(--gray-300)
- Spacing between: 2px

Rating Text:
- Font-size: 18px
- Font-weight: 600
- Color: var(--gray-900)

Review Count:
- Font-size: 14px
- Color: var(--gray-600)
- Format: "(11,234 reviews)"
- Margin-left: 8px
```

### 3. Quick Stats Bar
```
Container:
- Display: grid
- Grid-template-columns: repeat(auto-fit, minmax(120px, 1fr))
- Gap: 16px
- Padding: 20px
- Background: var(--gray-50)
- Border-radius: 12px
- Margin: 24px 0

Stat Item:
- Display: flex
- Flex-direction: column
- Gap: 4px

Stat Icon:
- Size: 24px × 24px
- Color: var(--color-primary) (#0077B6)
- Margin-bottom: 4px

Stat Label:
- Font-size: 12px
- Color: var(--gray-500)
- Text-transform: uppercase
- Letter-spacing: 0.05em

Stat Value:
- Font-size: 16px
- Font-weight: 600
- Color: var(--gray-900)

Difficulty Badge:
- Display: inline-block
- Padding: 4px 10px
- Border-radius: 6px
- Font-size: 14px
- Font-weight: 600
- Background (Beginner): #DBEAFE (blue-100)
- Color (Beginner): #0077B6 (ocean-blue)
- Background (Intermediate): #FED7AA (orange-200)
- Color (Intermediate): #EA580C (orange-600)
- Background (Advanced): #FEE2E2 (red-100)
- Color (Advanced): #DC2626 (red-600)
```

### 4. Map Component
```
Container:
- Width: 100%
- Height: 400px (desktop)
- Height: 300px (mobile)
- Border-radius: 12px
- Overflow: hidden
- Box-shadow: 0 1px 3px rgba(0,0,0,0.12)
- Margin: 24px 0

Map Controls:
- Position: absolute
- Top: 16px
- Right: 16px
- Z-index: 10

Zoom Buttons:
- Width: 36px
- Height: 36px
- Background: white
- Border: 1px solid var(--gray-300)
- Border-radius: 4px
- Box-shadow: 0 1px 2px rgba(0,0,0,0.1)
- Margin-bottom: 8px

Elevation Profile (below map):
- Height: 120px
- Background: white
- Border: 1px solid var(--gray-200)
- Border-radius: 0 0 12px 12px
- Padding: 16px
- Margin-top: -1px
```

### 5. Action Buttons
```
Container:
- Display: grid
- Grid-template-columns: repeat(4, 1fr)
- Gap: 12px
- Margin: 20px 0

Primary Button (Navigate):
- Height: 48px
- Background: var(--color-primary)
- Color: white
- Border: none
- Border-radius: 8px
- Font-size: 16px
- Font-weight: 600
- Padding: 0 24px
- Hover: background var(--color-primary-hover)
- Active: transform scale(0.98)

Secondary Buttons:
- Height: 48px
- Background: white
- Color: var(--gray-700)
- Border: 1px solid var(--gray-300)
- Border-radius: 8px
- Font-size: 16px
- Font-weight: 500
- Padding: 0 20px
- Hover: background var(--gray-50)

Icon in Button:
- Size: 20px × 20px
- Margin-right: 8px
- Vertical-align: middle
```

### 6. Description Section
```
Container:
- Padding: 24px 0
- Border-bottom: 1px solid var(--gray-200)

Title:
- Font-size: 24px
- Font-weight: 700
- Margin-bottom: 16px
- Color: var(--gray-900)

Description Text:
- Font-size: 16px
- Line-height: 26px
- Color: var(--gray-700)
- Max-height (collapsed): 120px
- Overflow: hidden
- Transition: max-height 0.3s ease

Show More Button:
- Display: inline-block
- Margin-top: 12px
- Color: var(--color-primary) (#0077B6)
- Font-size: 14px
- Font-weight: 600
- Cursor: pointer
- Hover: underline
```

### 7. Information Cards
```
Container:
- Display: grid
- Grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))
- Gap: 16px
- Margin: 24px 0

Card:
- Padding: 20px
- Background: var(--gray-50)
- Border: 1px solid var(--gray-200)
- Border-radius: 12px

Card Icon:
- Size: 32px × 32px
- Color: var(--color-primary) (#0077B6)
- Margin-bottom: 12px

Card Title:
- Font-size: 16px
- Font-weight: 600
- Margin-bottom: 8px
- Color: var(--gray-900)

Card Content:
- Font-size: 14px
- Line-height: 20px
- Color: var(--gray-600)

Warning Card:
- Background: #FFF7ED (orange-50)
- Border-color: #FFEDD5 (orange-100)
- Icon color: #FF7F11 (sunset-orange)
```

### 8. Trail Features
```
Container:
- Padding: 24px 0

Title:
- Font-size: 20px
- Font-weight: 700
- Margin-bottom: 16px

Features Grid:
- Display: grid
- Grid-template-columns: repeat(2, 1fr) (desktop)
- Grid-template-columns: 1fr (mobile)
- Gap: 12px

Feature Item:
- Display: flex
- Align-items: center
- Gap: 12px

Feature Icon:
- Size: 20px × 20px
- Color: var(--color-primary) (#0077B6)

Feature Text:
- Font-size: 15px
- Color: var(--gray-700)
```

### 9. Photo Gallery
```
Container:
- Margin: 32px 0

Title:
- Font-size: 20px
- Font-weight: 700
- Margin-bottom: 16px

Photo Grid:
- Display: grid
- Grid-template-columns: repeat(4, 1fr) (desktop)
- Grid-template-columns: repeat(2, 1fr) (mobile)
- Gap: 8px

Photo Container:
- Aspect-ratio: 1 / 1
- Border-radius: 8px
- Overflow: hidden
- Position: relative
- Cursor: pointer

Photo:
- Width: 100%
- Height: 100%
- Object-fit: cover
- Transition: transform 0.3s ease
- Hover: transform scale(1.05)

More Photos Overlay (last item):
- Position: absolute
- Inset: 0
- Background: rgba(0, 0, 0, 0.6)
- Color: white
- Display: flex
- Align-items: center
- Justify-content: center
- Font-size: 18px
- Font-weight: 600
```

### 10. Reviews Section
```
Container:
- Padding: 32px 0
- Border-top: 1px solid var(--gray-200)

Header:
- Display: flex
- Justify-content: space-between
- Align-items: center
- Margin-bottom: 24px

Title:
- Font-size: 24px
- Font-weight: 700

Sort Dropdown:
- Height: 40px
- Padding: 0 12px
- Border: 1px solid var(--gray-300)
- Border-radius: 8px
- Font-size: 14px

Rating Distribution:
- Display: flex
- Gap: 24px
- Margin-bottom: 24px

Rating Bar:
- Display: flex
- Align-items: center
- Gap: 8px

Star Label:
- Font-size: 14px
- Color: var(--gray-600)
- Width: 20px

Progress Bar:
- Width: 200px
- Height: 8px
- Background: var(--gray-200)
- Border-radius: 4px
- Overflow: hidden

Progress Fill:
- Height: 100%
- Background: #FFC107

Count:
- Font-size: 14px
- Color: var(--gray-500)

Review Card:
- Padding: 20px
- Border-bottom: 1px solid var(--gray-200)

Reviewer Info:
- Display: flex
- Align-items: center
- Gap: 12px
- Margin-bottom: 12px

Avatar:
- Width: 48px
- Height: 48px
- Border-radius: 50%
- Background: var(--gray-300)

Reviewer Name:
- Font-size: 16px
- Font-weight: 600
- Color: var(--gray-900)

Review Date:
- Font-size: 14px
- Color: var(--gray-500)

Review Text:
- Font-size: 15px
- Line-height: 24px
- Color: var(--gray-700)
- Margin: 12px 0

Review Photos:
- Display: flex
- Gap: 8px
- Margin-top: 12px

Review Photo:
- Width: 80px
- Height: 80px
- Border-radius: 8px
- Object-fit: cover
- Cursor: pointer
```

### 11. Weather Widget
```
Container:
- Padding: 20px
- Background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
- Border-radius: 12px
- Color: white

Current Weather:
- Display: flex
- Align-items: center
- Margin-bottom: 20px

Weather Icon:
- Size: 64px × 64px

Temperature:
- Font-size: 48px
- Font-weight: 700
- Margin-left: 16px

Condition:
- Font-size: 18px
- Opacity: 0.9

Forecast:
- Display: grid
- Grid-template-columns: repeat(5, 1fr)
- Gap: 12px

Forecast Day:
- Text-align: center

Day Name:
- Font-size: 12px
- Text-transform: uppercase
- Opacity: 0.8
- Margin-bottom: 8px

Forecast Icon:
- Size: 32px × 32px
- Margin: 0 auto 8px

Temp Range:
- Font-size: 14px
- Font-weight: 600
```

### 12. Mobile Breakpoints
```
Desktop: ≥1024px
Tablet: 768px - 1023px
Mobile: <768px

Mobile Adjustments:
- Single column layout
- Stack sidebar content below main content
- Reduce font sizes by 10-15%
- Increase touch targets to minimum 44px × 44px
- Hide less critical information
- Convert grid layouts to single column
- Reduce image sizes
- Add horizontal scrolling for stats bar
```

### 13. Interactive States
```
Hover States:
- Transition: all 0.2s ease
- Links: color var(--color-primary-hover) (#006699)
- Cards: box-shadow 0 4px 12px rgba(0,0,0,0.1)
- Buttons: transform translateY(-1px)

Focus States:
- Outline: 2px solid var(--color-primary) (#0077B6)
- Outline-offset: 2px

Active/Pressed:
- Transform: scale(0.98)
- Opacity: 0.9

Loading States:
- Skeleton background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)
- Animation: shimmer 1.5s infinite
```

### 14. Accessibility Requirements
```
- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text
- Focus indicators visible
- Touch targets minimum 44px × 44px
- Alt text for all images
- ARIA labels for interactive elements
- Semantic HTML structure
- Keyboard navigation support
```

## Implementation Notes

1. Use CSS Grid and Flexbox for responsive layouts
2. Implement lazy loading for images below the fold
3. Use srcset for responsive images
4. Optimize font loading with font-display: swap
5. Implement smooth scroll behavior for anchor links
6. Use intersection observer for animation triggers
7. Implement virtual scrolling for long review lists
8. Cache map tiles for offline viewing
9. Use CSS custom properties for theming
10. Implement print stylesheet for trail maps

## Performance Targets
- First Contentful Paint: <1.2s
- Time to Interactive: <3.5s
- Cumulative Layout Shift: <0.1
- Largest Contentful Paint: <2.5s
