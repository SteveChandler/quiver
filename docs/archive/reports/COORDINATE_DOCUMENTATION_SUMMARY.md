# Coordinate Naming Documentation Summary

**Date**: November 17, 2025
**Status**: Complete
**Purpose**: Comprehensive documentation of coordinate naming conventions to prevent future bugs

## Overview

This document summarizes the complete coordinate naming documentation created for the Quiver application following the critical bug fix in the Local Intel feature where inconsistent coordinate naming (`center_lat`/`center_lng` vs `latitude`/`longitude`) caused feature failure.

## Problem Context

### The Bug

**Root Cause**: Beach data used `center_lat` and `center_lng` from the database (PostGIS legacy naming), while the `useIntelData` hook expected `latitude` and `longitude` props. This mismatch caused the Local Intel feature to fail silently.

**Impact**:
- Local Intel feature completely broken
- No error messages in production
- Silent failure due to undefined property access
- Required emergency fix and comprehensive documentation

### Prevention Strategy

To prevent similar issues in the future, we've created multi-layered documentation covering:
1. Official naming standards across all layers
2. Explicit mapping patterns
3. Runtime validation utilities
4. Type safety guidelines
5. Testing requirements
6. Code review checklist

## Documentation Created

### 1. Main Coordinate Conventions Guide

**File**: `/docs/COORDINATE_CONVENTIONS.md`

**Purpose**: Comprehensive reference for all coordinate naming conventions

**Contents**:
- Official naming standards (lat/lon, NOT lng)
- Layer-specific conventions (database, TypeScript, API, components)
- Common patterns and pitfalls
- Type definitions reference
- Validation guidelines
- Database schema documentation
- Migration guide for updating existing code
- Testing conventions
- Code review checklist
- Contributing guidelines

**Key Sections**:
```
- Overview & Background
- Official Naming Standards
  - Primary Convention
  - Layer-Specific Conventions
    - Database Layer (PostgreSQL/PostGIS)
    - TypeScript/JavaScript Layer
    - API Endpoints
- Common Patterns (3 examples)
- Common Pitfalls (3 examples)
- Type Definitions Reference
- Validation
- Database Schema
- Migration Guide
- Examples (3 comprehensive examples)
- Testing Conventions
- Code Review Checklist
- Contributing Guidelines
- Related Documentation
- References
- Changelog
- Summary (Quick Reference Table + Golden Rules)
```

**Size**: ~650 lines

### 2. Components Architecture Update

**File**: `/components/ARCHITECTURE.md`

**Addition**: New section "Coordinate Naming Conventions" inserted after "TypeScript Excellence"

**Contents**:
- Critical warning about coordinate naming consistency
- Standard naming rules
- Database to component mapping examples
- API parameter patterns
- Validation requirements
- Common pitfalls (4 items)
- Reference to comprehensive guide

**Integration**: Seamlessly integrated into existing architecture documentation

### 3. Supabase Architecture Update

**File**: `/supabase/ARCHITECTURE.md`

**Addition**: New section "Coordinate Naming Conventions" added at end of document

**Contents**:
- Database schema standards
- Canonical coordinate columns (legacy vs new)
- Database function parameters
- Application layer mapping
- Migration considerations (7-step checklist)
- Reference to comprehensive guide

**Integration**: Added as standalone section with clear migration warnings

### 4. CLAUDE.md Update

**File**: `/.claude/CLAUDE.md`

**Addition**: New section "Coordinate Naming Conventions (CRITICAL)" added to "Project-Specific Guidelines"

**Contents**:
- Standard naming rules
- Layer-specific rules (5 layers)
- Critical database mapping examples
- Validation requirements
- Common pitfalls (4 items)
- Reference to comprehensive guide

**Integration**: Added as critical guideline between "Data Fetching Pattern" and "Database Work"

### 5. Documentation Index Update

**File**: `/docs/README.md`

**Addition**: New section "Coordinate Conventions" added to documentation categories

**Contents**:
- Three documentation files listed
- Quick reference code example
- Clear warnings about lng usage
- Database mapping pattern example

**Integration**: Added as new category after "Data & Schema"

## Documentation Organization

### Primary Documentation

```
/docs/COORDINATE_CONVENTIONS.md
├── Comprehensive guide (650 lines)
├── Official source of truth
├── All patterns and examples
├── Migration guide
└── Complete reference

Referenced by:
├── /components/ARCHITECTURE.md
├── /supabase/ARCHITECTURE.md
├── /.claude/CLAUDE.md
└── /docs/README.md
```

### Supporting Documentation

**Already Existing**:
- `/docs/COORDINATE_VALIDATION.md` - Runtime validation utilities
- `/docs/IMPLEMENTATION_SUMMARY_COORDINATE_VALIDATION.md` - Implementation summary

**Integration**:
- All three documents cross-reference each other
- COORDINATE_CONVENTIONS.md focuses on naming standards
- COORDINATE_VALIDATION.md focuses on runtime validation
- IMPLEMENTATION_SUMMARY provides implementation context

## Key Standards Established

### Naming Convention Matrix

| Context | Latitude | Longitude | Notes |
|---------|----------|-----------|-------|
| **Database (legacy)** | `center_lat` | `center_lng` | PostGIS legacy, DO NOT change |
| **Database (new)** | `latitude` | `longitude` | Standard for new tables |
| **Component Props** | `latitude` | `longitude` | Full names for clarity |
| **API Parameters** | `lat` | `lon` | Short names, NOT lng |
| **API Responses** | `latitude` | `longitude` | Full names |
| **Hook Parameters** | `latitude` | `longitude` | Full names for clarity |

### Golden Rules

1. **NEVER use `lng`** - Always use `lon` (short) or `longitude` (full)
2. **Map explicitly** - Don't assume property names match between layers
3. **Validate always** - Use coordinate validation utilities
4. **Test thoroughly** - Add tests for coordinate mapping
5. **Document changes** - Update guides when patterns evolve

## Code Examples

### Correct Database Mapping

```typescript
// ✅ CORRECT - Explicit mapping
const IntelTab = ({ beach }: { beach: Beach }) => {
  return (
    <BeachIntelSection
      latitude={beach.center_lat}   // Map: center_lat → latitude
      longitude={beach.center_lng}  // Map: center_lng → longitude
      beachId={beach.id}
    />
  );
};
```

### Correct API Call

```typescript
// ✅ CORRECT - Use lon, not lng
const params = {
  lat: beach.center_lat,
  lon: beach.center_lng,  // NOT lng!
  radius: 5,
};
```

### Correct Validation

```typescript
// ✅ CORRECT - Validate before use
import { assertValidCoordinates } from '@/lib/coordinate-validation';

assertValidCoordinates(latitude, longitude, 'useIntelData');
```

## Integration Points

### Architecture Documentation

**Components Architecture** (`/components/ARCHITECTURE.md`):
- Added after "TypeScript Excellence" section
- Provides quick reference for component developers
- Links to comprehensive guide

**Supabase Architecture** (`/supabase/ARCHITECTURE.md`):
- Added as final section
- Focuses on database schema conventions
- Emphasizes migration considerations

**CLAUDE.md** (`/.claude/CLAUDE.md`):
- Added to "Project-Specific Guidelines"
- Marked as CRITICAL
- Quick reference for AI assistants

**Documentation Index** (`/docs/README.md`):
- Added as new category
- Quick reference code example
- Links to all three coordinate docs

### Related Documentation

**Existing Validation Docs**:
- `/docs/COORDINATE_VALIDATION.md` - Runtime validation
- `/docs/IMPLEMENTATION_SUMMARY_COORDINATE_VALIDATION.md` - Implementation
- Cross-referenced in new documentation

**Database Docs**:
- `/supabase/ARCHITECTURE.md` - Database schema
- Migration files referenced
- PostGIS conventions explained

**Testing Docs**:
- `/e2e/ARCHITECTURE.md` - E2E testing patterns
- Test examples in COORDINATE_CONVENTIONS.md

## Prevention Mechanisms

### 1. Documentation Layer
- Comprehensive guide with all patterns
- Clear examples and anti-patterns
- Quick reference tables

### 2. Architecture Layer
- Integrated into architecture docs
- Part of standard patterns
- Required reading for new features

### 3. Code Review Layer
- Code review checklist included
- Clear criteria for coordinate code
- Contributing guidelines

### 4. Validation Layer
- Runtime validation utilities
- Development warnings
- Type guards and assertions

### 5. Testing Layer
- Testing conventions documented
- Example tests provided
- E2E test patterns

### 6. Education Layer
- Clear explanations of "why"
- Historical context (the bug)
- Migration guidance

## Files Modified

### Created (1 file)
1. `/docs/COORDINATE_CONVENTIONS.md` (650 lines)

### Modified (4 files)
1. `/components/ARCHITECTURE.md` (+60 lines)
2. `/supabase/ARCHITECTURE.md` (+45 lines)
3. `/.claude/CLAUDE.md` (+50 lines)
4. `/docs/README.md` (+25 lines)

**Total**: 5 files, ~830 lines of documentation

## Success Metrics

### Documentation Quality
- ✅ Comprehensive coverage of all layers
- ✅ Clear examples for every pattern
- ✅ Anti-patterns documented
- ✅ Migration guide provided
- ✅ Quick reference tables
- ✅ Cross-references between docs

### Integration Quality
- ✅ Integrated into all architecture docs
- ✅ Discoverable through multiple paths
- ✅ Consistent messaging across docs
- ✅ Clear priority (marked CRITICAL)

### Developer Experience
- ✅ Easy to find (5 entry points)
- ✅ Quick reference available
- ✅ Examples for common tasks
- ✅ Clear "do this, not that" guidance
- ✅ Code review checklist
- ✅ Testing patterns

### Maintenance
- ✅ Single source of truth (COORDINATE_CONVENTIONS.md)
- ✅ Other docs reference primary doc
- ✅ Clear update process
- ✅ Changelog for tracking changes

## Usage Guidelines

### For New Developers

1. **First Read**: `/docs/COORDINATE_CONVENTIONS.md` (15 minutes)
2. **Quick Reference**: Summary table at end of doc
3. **When Needed**: Search for specific patterns/examples
4. **Code Review**: Use checklist before PR

### For Feature Development

1. **Planning**: Review coordinate conventions
2. **Implementation**: Follow mapping patterns
3. **Validation**: Use validation utilities
4. **Testing**: Add coordinate mapping tests
5. **Review**: Check against checklist

### For Code Review

1. **Check Naming**: Verify lon (not lng) usage
2. **Check Mapping**: Verify explicit database mapping
3. **Check Validation**: Verify validation utilities used
4. **Check Tests**: Verify coordinate tests present
5. **Check Types**: Verify type definitions accurate

## Future Enhancements

### Short Term (Optional)
1. Linter rule to detect `lng` usage
2. Type utility to enforce coordinate naming
3. ESLint plugin for coordinate validation
4. Automated tests for coordinate mapping

### Long Term (Future Consideration)
1. Database migration to standardize naming
2. Automated coordinate mapping utilities
3. Runtime coordinate type checking
4. Admin dashboard for coordinate validation

## Conclusion

### What We've Achieved

1. **Comprehensive Documentation**: 650-line guide covering all aspects
2. **Multi-Layer Integration**: Updated 4 architecture documents
3. **Clear Standards**: Official naming conventions established
4. **Prevention Mechanisms**: 6 layers of prevention
5. **Developer-Friendly**: Easy to find and use
6. **Maintainable**: Single source of truth with references

### Impact

**Before**:
- No coordinate naming standards
- Inconsistent usage across layers
- Silent failures from property mismatches
- No validation or warnings

**After**:
- Official naming standards documented
- Clear patterns for every layer
- Explicit mapping required
- Runtime validation available
- Development warnings
- Code review checklist
- Testing patterns

### Next Steps

**Immediate**:
- ✅ Documentation complete
- ✅ Architecture docs updated
- ✅ Standards established

**Ongoing**:
- Reference docs when implementing features
- Update docs when patterns evolve
- Enforce in code reviews
- Add to onboarding checklist

**Future** (Optional):
- Consider automated enforcement
- Evaluate database migration
- Add linter rules

## Related Documentation

### Must Read
- [COORDINATE_CONVENTIONS.md](/docs/COORDINATE_CONVENTIONS.md) - Primary guide
- [COORDINATE_VALIDATION.md](/docs/COORDINATE_VALIDATION.md) - Validation utilities

### Architecture
- [Components ARCHITECTURE.md](/components/ARCHITECTURE.md) - Component patterns
- [Supabase ARCHITECTURE.md](/supabase/ARCHITECTURE.md) - Database schema
- [CLAUDE.md](/.claude/CLAUDE.md) - AI assistant guidelines

### Reference
- [Documentation README](/docs/README.md) - All documentation index
- [Implementation Summary](/docs/IMPLEMENTATION_SUMMARY_COORDINATE_VALIDATION.md) - Validation implementation

---

**Status**: Complete and ready for use
**Last Updated**: November 17, 2025
**Maintenance**: Update COORDINATE_CONVENTIONS.md when patterns change; other docs reference it
**Questions**: See COORDINATE_CONVENTIONS.md or ask in team chat
