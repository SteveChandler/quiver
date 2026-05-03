# SEO Components Architecture

## 🎯 **PURPOSE**

The SEO components provide structured data and metadata management for search engine optimization, enhancing discoverability and rich snippet generation across the application.

## 📁 **COMPONENT STRUCTURE**

```
components/seo/
└── structured-data.tsx    # JSON-LD structured data for search engines
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Structured Data Pattern**

```typescript
SEOSystem
├── StructuredData (Generic JSON-LD)
├── HomePageStructuredData (Organization/App)
└── BeachPageStructuredData (Local Business/Place)
```

### **JSON-LD Generation Pattern**

```typescript
// Centralized structured data generation
const getStructuredData = (type: string, customData?: any) => {
  const baseData = getOrganizationData();
  const typeSpecificData = getTypeSpecificData(type);
  return { ...baseData, ...typeSpecificData, ...customData };
};
```

## 📊 **COMPONENT RESPONSIBILITIES**

### **StructuredData** (Generic Component)

- **Purpose**: Flexible structured data injection for any page type
- **Props**: `type, customData`
- **Features**:
  - Multi-type support (organization, software, website, all)
  - Custom data merging
  - JSON-LD script injection
  - Type-safe data validation

**Supported Schema Types:**

```typescript
interface StructuredDataProps {
  type?: "organization" | "softwareApplication" | "website" | "all";
  customData?: Record<string, any>;
}

// Base organization schema
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Quiver",
  description: "Community-driven surf forecasting and session tracking",
  url: "https://www.quiversurf.app",
  logo: "https://www.quiversurf.app/quiver-app-icon.png",
  sameAs: [
    "https://twitter.com/quiversurf",
    "https://instagram.com/quiversurf",
  ],
};
```

### **HomePageStructuredData** (Landing Page)

- **Purpose**: Rich structured data for the main application landing page
- **Features**:
  - Organization information
  - Software application schema
  - Feature highlights
  - User ratings and reviews
  - Download/access information

**Homepage Schema:**

```typescript
const homepageSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Quiver",
  applicationCategory: "SportsApplication",
  description:
    "Track surf sessions, discover beaches, and connect with the surfing community",
  operatingSystem: ["Web", "iOS", "Android"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  // NOTE: Do NOT add aggregateRating with fabricated numbers here.
  // Google prohibits hardcoded ratings not sourced from real reviews.
};
```

### **BeachPageStructuredData** (Location Pages)

- **Purpose**: Local business and place schema for beach detail pages
- **Props**: `beachName, description, latitude, longitude, rating, reviewCount`
- **Features**:
  - Local business schema
  - Geographic coordinates
  - Photo gallery references
  - Activity information
  - Intentionally omits review snippet markup (`AggregateRating`) for Place-based schemas

**Beach Schema:**

```typescript
interface BeachPageStructuredDataProps {
  beachName: string;
  description: string;
  latitude: number;
  longitude: number;
  rating?: number;
  reviewCount?: number;
}

const beachSchema = {
  "@context": "https://schema.org",
  "@type": ["Place", "SportsActivityLocation"],
  name: beachName,
  description: description,
  geo: {
    "@type": "GeoCoordinates",
    latitude: latitude,
    longitude: longitude,
  },
  // NOTE: Do not emit AggregateRating here. Google review snippets do not support
  // ratings for Place/Beach types, and emitting it can trigger Search Console
  // "Review snippets" errors.
};
```

## 🎨 **DESIGN PATTERNS**

### **Script Injection Pattern**

```typescript
// Safe JSON-LD injection with dangerouslySetInnerHTML
export function StructuredData({
  type = "all",
  customData,
}: StructuredDataProps) {
  const structuredData = getStructuredData();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2),
      }}
    />
  );
}
```

### **Conditional Schema Assembly**

```typescript
const getStructuredData = () => {
  const schemas = [];

  if (type === "organization" || type === "all") {
    schemas.push(organizationSchema);
  }

  if (type === "softwareApplication" || type === "all") {
    schemas.push(softwareApplicationSchema);
  }

  // Return single schema or array based on count
  return schemas.length === 1 ? schemas[0] : schemas;
};
```

### **Data Merging Strategy**

```typescript
// Custom data override pattern
const mergedData = {
  ...baseSchema,
  ...customData,
  // Preserve critical fields
  "@context": baseSchema["@context"],
  "@type": baseSchema["@type"],
};
```

## 🚀 **SEO OPTIMIZATION FEATURES**

### **Rich Snippets Support**

```typescript
// Enhanced organization schema
const enhancedOrganizationSchema = {
  "@type": "Organization",
  name: "Quiver",
  alternateName: "Quiver Surf App",
  description: "Community-driven surf forecasting platform",
  foundingDate: "2024",
  founder: {
    "@type": "Person",
    name: "Quiver Team",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "support@quiver.surf",
  },
};
```

### **Local SEO Enhancement**

```typescript
// Beach location schema with local business features
const localBusinessSchema = {
  "@type": ["Place", "TouristAttraction", "LocalBusiness"],
  businessStatus: "OPERATIONAL",
  priceRange: "Free",
  amenityFeature: [
    {
      "@type": "LocationFeatureSpecification",
      name: "Surfing",
      value: true,
    },
    {
      "@type": "LocationFeatureSpecification",
      name: "Parking",
      value: true,
    },
  ],
};
```

### **Review Integration**

```typescript
// Review schema for beach pages
if (rating && reviewCount) {
  beachSchema.aggregateRating = {
    "@type": "AggregateRating",
    ratingValue: rating.toString(),
    reviewCount: reviewCount.toString(),
    bestRating: "5",
    worstRating: "1",
  };
}
```

## 🔍 **SEARCH ENGINE FEATURES**

### **Multiple Schema Types**

```typescript
// Support for multiple concurrent schemas
const multipleSchemas = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    // Organization data
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    // App data
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    // Website data
  },
];
```

### **Breadcrumb Schema**

```typescript
// Breadcrumb navigation for beach pages
const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.quiversurf.app",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Beaches",
      item: "https://www.quiversurf.app/map",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: beachName,
      item: `https://www.quiversurf.app/beach/${beachId}`,
    },
  ],
};
```

### **Event Schema for Sessions**

```typescript
// Future: Session/event schema
const sessionEventSchema = {
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  name: "Surf Session",
  sport: "Surfing",
  location: {
    "@type": "Place",
    name: beachName,
    geo: {
      "@type": "GeoCoordinates",
      latitude: latitude,
      longitude: longitude,
    },
  },
  startDate: sessionDate,
  eventStatus: "EventScheduled",
};
```

## 📱 **MOBILE & PERFORMANCE**

### **Minimal Bundle Impact**

```typescript
// Lightweight component with no runtime JS
export function StructuredData({
  type = "all",
  customData,
}: StructuredDataProps) {
  // Pure data generation, no React state or effects
  const structuredData = getStructuredData();

  // Static script injection
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
```

### **SSR Optimization**

```typescript
// Server-side rendered structured data
// No client-side hydration needed
// Immediate availability to search engine crawlers
```

## 🔧 **INTEGRATION PATTERNS**

### **Next.js Head Integration**

```typescript
// Usage in page components
import { BeachPageStructuredData } from "@/components/seo/structured-data";

export default function BeachPage({ beach }) {
  return (
    <>
      <Head>
        <title>{beach.name} - Quiver</title>
        <meta name="description" content={beach.description} />
      </Head>

      <BeachPageStructuredData
        beachName={beach.name}
        description={beach.description}
        latitude={beach.latitude}
        longitude={beach.longitude}
        rating={beach.rating}
        reviewCount={beach.reviewCount}
      />

      <main>{/* Page content */}</main>
    </>
  );
}
```

### **Dynamic Data Integration**

```typescript
// Real-time data integration
const dynamicBeachData = {
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: calculateAverageRating(reviews),
    reviewCount: reviews.length,
    ratingExplanation: "Based on community reviews",
  },
  photo: recentPhotos.map((photo) => ({
    "@type": "ImageObject",
    url: photo.url,
    caption: photo.caption,
  })),
};
```

## 🧪 **TESTING & VALIDATION**

### **Schema Validation**

```typescript
// Validate generated schemas
const validateSchema = (schema: any) => {
  // Ensure required fields are present
  if (!schema["@context"] || !schema["@type"]) {
    throw new Error("Invalid schema: missing required fields");
  }

  // Type-specific validation
  if (schema["@type"] === "Organization" && !schema.name) {
    throw new Error("Organization schema requires name");
  }
};
```

### **SEO Testing Tools**

- Google Rich Results Test
- Schema.org validator
- Lighthouse SEO audits
- Search Console monitoring

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Event schema for surf sessions
- Product schema for gear recommendations
- FAQ schema for help pages
- Recipe schema for surf tips
- Video schema for session content

### **Advanced SEO Features**

- Automatic sitemap generation
- Meta tag optimization
- Open Graph integration
- Twitter Card support
- Canonical URL management

---

**Last Updated**: January 2025  
**Status**: Production-ready with comprehensive structured data  
**Next Review**: After advanced SEO features implementation
