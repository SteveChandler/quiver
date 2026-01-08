# Quiver Documentation

This directory contains the essential documentation for the Quiver surf app, now organized by purpose for easier navigation.

## 🚀 **Quick Start (New Developers)**

**First time here? Start with these guides:**

| Guide                                                               | Time   | Purpose                              |
| ------------------------------------------------------------------- | ------ | ------------------------------------ |
| **[quick-start/NEW_DEVELOPER.md](quick-start/NEW_DEVELOPER.md)** ⭐ | 15 min | Complete setup from zero to running  |
| **[setup/SUPABASE_SETUP.md](setup/SUPABASE_SETUP.md)** ⭐           | 10 min | How to connect to Supabase correctly |
| **[guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md)**              | 15 min | Running and writing tests            |
| **[quick-start/COMMON_TASKS.md](quick-start/COMMON_TASKS.md)**      | 5 min  | Daily development tasks              |

## 📚 **Documentation by Category**

### 🔧 **Setup & Configuration**

Essential guides for setting up your development environment:

- **[setup/SETUP.md](setup/SETUP.md)** - Development environment setup guide
- **[setup/SUPABASE_SETUP.md](setup/SUPABASE_SETUP.md)** ⭐ - Complete Supabase connection guide
- **[setup/SENTRY_SETUP.md](setup/SENTRY_SETUP.md)** - Error monitoring setup
- **[setup/PUSH_NOTIFICATIONS_SETUP.md](setup/PUSH_NOTIFICATIONS_SETUP.md)** - Firebase FCM setup for mobile and web
- **[setup/setup-github-secrets.md](setup/setup-github-secrets.md)** - GitHub secrets configuration guide

### 📖 **Developer Guides**

Day-to-day development references:

- **[guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md)** ⭐ - Comprehensive testing guide with Jest and Playwright
- **[guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md)** - Development troubleshooting guide and common issues
- **[guides/DEV_TESTING.md](guides/DEV_TESTING.md)** - Testing against dev.quiversurf.app
- **[guides/DEPLOYMENT_CHECKLIST.md](guides/DEPLOYMENT_CHECKLIST.md)** - Production deployment checklist
- **[guides/IOS_RELEASE_GUIDE.md](guides/IOS_RELEASE_GUIDE.md)** - Complete iOS App Store submission guide
- **[guides/TUNNEL_AUTOMATION_SUMMARY.md](guides/TUNNEL_AUTOMATION_SUMMARY.md)** - Mobile development tunnel automation
- **[guides/E2E_TEST_PLAN.md](guides/E2E_TEST_PLAN.md)** - End-to-end testing strategy

### 🏗️ **Architecture & Strategy**

System design and technical patterns:

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Top-level architecture index with mobile architecture, stack overview, patterns, and growth strategy
- **[reports/ARCHITECTURE_REVIEW_2025-12-28.md](reports/ARCHITECTURE_REVIEW_2025-12-28.md)** - Full-repo architecture review report (strengths, risks, recommendations)
- **[architecture/DESIGN_PRINCIPLES.md](architecture/DESIGN_PRINCIPLES.md)** - Core design philosophy, technical patterns, and motion design system
- **[architecture/STYLE_GUIDE.md](architecture/STYLE_GUIDE.md)** - Brand identity, UI/UX standards, design tokens, and DRY component patterns
- **[architecture/MIDDLEWARE.md](architecture/MIDDLEWARE.md)** - Middleware architecture, authentication, and security patterns
- **[diagrams/](diagrams/)** - Architecture diagrams
- **[adr/](adr/)** - Architecture Decision Records

### ⚙️ **Features**

Feature-specific implementation documentation:

- **[features/GAMIFICATION.md](features/GAMIFICATION.md)** - Gamification system (XP, badges, levels, NPC daily activity)
- **[features/BEACH_PAGE_DESIGN.md](features/BEACH_PAGE_DESIGN.md)** - Beach detail page design with AllTrails-inspired layout
- **[features/AUTH_IMPLEMENTATION.md](features/AUTH_IMPLEMENTATION.md)** - Authentication patterns and server actions
- **[features/PHOTO_UPLOAD.md](features/PHOTO_UPLOAD.md)** - Complete photo upload guide (compression, validation, security, storage)
- **[features/SOCIAL_SHARING.md](features/SOCIAL_SHARING.md)** - Native-first sharing via Capacitor share sheet and client-side generation
- **[features/LOCATION_PAGES.md](features/LOCATION_PAGES.md)** - AllTrails-style location browsing with intelligent ranking

### 📊 **Analytics**

Product analytics, funnels, and event tracking:

- **[analytics/ACTIVATION_FUNNEL.md](analytics/ACTIVATION_FUNNEL.md)** ⭐ - Activation funnel definition, GA4 setup, and success metrics

### 🔬 **Research & Analysis**

Research findings and competitive analysis:

- **[research/FORECASTING_RESEARCH.md](research/FORECASTING_RESEARCH.md)** - Surf forecasting research and improvements
- **[research/learned_from_reddit.md](research/learned_from_reddit.md)** - Raw findings from Reddit surf community research
- **[research/reddit_guidance.md](research/reddit_guidance.md)** - Implementation guide based on Reddit feedback
- **[research/ALLTRAILS_QUIVER_COMPARISON.md](research/ALLTRAILS_QUIVER_COMPARISON.md)** - AllTrails vs Quiver comparison
- **[research/ALLTRAILS_UX_FLOWS.md](research/ALLTRAILS_UX_FLOWS.md)** - AllTrails UX flow analysis
- **[research/alltrails_layout_spec.md](research/alltrails_layout_spec.md)** - AllTrails technical layout reference
- **[research/global-surfing-hubs.md](research/global-surfing-hubs.md)** - Global surf community research for future expansion

### 📊 **Data & Schema**

Database schema and data management:

- **[data/database-coordinate-conventions.md](data/database-coordinate-conventions.md)** - Coordinate system conventions
- **[data/coordinate-naming-audit.md](data/coordinate-naming-audit.md)** - Coordinate naming audit results
- **[data/data-quality-audit-results.md](data/data-quality-audit-results.md)** - Data quality audit findings
- **[data/PHASE_5_METRO_AREAS.md](data/PHASE_5_METRO_AREAS.md)** - Metro areas implementation

### 📍 **Coordinate Conventions**

Critical coordinate naming standards to prevent mapping bugs:

- **[COORDINATE_CONVENTIONS.md](COORDINATE_CONVENTIONS.md)** ⚠️ - Official coordinate naming standards (NEW)
  - Standard naming: `lat`, `lon` (NOT `lng`)
  - Database to component mapping patterns
  - Type definitions and validation
  - Common pitfalls and migration guide
- **[COORDINATE_VALIDATION.md](COORDINATE_VALIDATION.md)** - Runtime validation system
  - Validation utilities and type guards
  - Development warnings and production safety
  - Testing patterns and examples
- **[IMPLEMENTATION_SUMMARY_COORDINATE_VALIDATION.md](IMPLEMENTATION_SUMMARY_COORDINATE_VALIDATION.md)** - Implementation summary

**Quick Reference**:

```typescript
✅ CORRECT: lat, lon, latitude, longitude
❌ WRONG: lng (never use in new code)

// Database → Component mapping
<Component
  latitude={beach.center_lat}   // Explicit mapping required
  longitude={beach.center_lng}  // NOT beach.latitude!
/>
```

### 📚 **Reference**

Technical references and development tools:

- **[reference/CHANGELOG.md](reference/CHANGELOG.md)** - Complete change history and recent updates
- **[reference/CLAUDE.md](reference/CLAUDE.md)** - Claude Code contributor guide and development workflow
- **[reference/CURSOR_AGENTS.md](reference/CURSOR_AGENTS.md)** - Cursor agent configurations and MCP integration
- **[reference/DEPENDENCIES.md](reference/DEPENDENCIES.md)** - Dependency documentation
- **[reference/PERSONALIZATION_STRATEGY.md](reference/PERSONALIZATION_STRATEGY.md)** - Personalization and recommendation engine strategy
- **[reference/BUGS.md](reference/BUGS.md)** - Known issues (if not using GitHub Issues)

### 📦 **Quick Start Guides**

Fast-track guides for common scenarios:

- **[quick-start/NEW_DEVELOPER.md](quick-start/NEW_DEVELOPER.md)** - 15-minute onboarding guide
- **[quick-start/RUNNING_TESTS.md](quick-start/RUNNING_TESTS.md)** - Quick test command reference
- **[quick-start/COMMON_TASKS.md](quick-start/COMMON_TASKS.md)** - Common development tasks

### 📦 **Archives**

Historical documentation (preserved for reference):

- **[reports/archive/](reports/archive/)** - Archived test reports, summaries, and completion reports
- **[planning/archive/](planning/archive/)** - Archived implementation plans
- **[analysis/](analysis/)** - Historical analysis reports

## 🎯 **Current Focus**

The documentation is streamlined to support the **growth-first strategy** (0 → 1,000 users in 6 months):

- **Architecture**: Production-ready social platform with viral growth features
- **Design**: Professional quality with conversion optimization
- **Development**: Established patterns for rapid feature development
- **Strategy**: User acquisition over technical perfection

## 📖 **Documentation Principles**

1. **Current State**: All docs reflect implemented features and current architecture
2. **Growth-Focused**: Prioritizes user acquisition and viral mechanics
3. **Developer-Friendly**: Clear patterns and examples for rapid development
4. **Maintained**: Regular updates to match actual implementation
5. **Organized by Purpose**: Easy navigation by task or topic

## 🔄 **Recent Updates**

**January 2025 (Latest)**: Added Analytics documentation

**January 2025 Changes:**

- 📊 **NEW:** Analytics documentation category with activation funnel definition
  - `analytics/ACTIVATION_FUNNEL.md` - Complete GA4 funnel setup and benchmarks

**November 2025**: Phase 2 Documentation Consolidation - reduced redundancy

**Phase 2 Changes:**

- 📝 **Consolidated 13 → 4 feature docs**: Merged overlapping documentation
  - Photo Upload: 2 files → 1 comprehensive guide
  - Middleware: 4 files → 1 architecture doc
  - Social Sharing: 4 files → 1 production guide
  - Location Pages: 3 files → 1 complete reference
- 🧹 Removed duplicate content while preserving all technical details
- 📚 Created focused, production-ready guides following consistent structure
- 🗂️ Enhanced docs/README.md with consolidated file references

**Phase 1 Changes (Earlier November 2025)**:

- ✨ **NEW:** Organized by purpose (setup/, guides/, features/, research/, reference/, data/)
- 📁 Moved 25+ completed reports to reports/archive/
- 📁 Moved 4 implementation plans to planning/archive/
- 🧹 Cleaner top-level docs directory
- 🗂️ Improved discoverability and navigation

**Previous (January 2025)**: Major documentation improvements - See [DOCUMENTATION_IMPROVEMENTS_2025.md](DOCUMENTATION_IMPROVEMENTS_2025.md)

---

## 🎯 **Finding What You Need**

### I need to...

- **Set up my dev environment** → [quick-start/NEW_DEVELOPER.md](quick-start/NEW_DEVELOPER.md)
- **Connect to Supabase** → [setup/SUPABASE_SETUP.md](setup/SUPABASE_SETUP.md)
- **Run tests** → [quick-start/RUNNING_TESTS.md](quick-start/RUNNING_TESTS.md) or [guides/TESTING_GUIDE.md](guides/TESTING_GUIDE.md)
- **Fix a problem** → [guides/TROUBLESHOOTING.md](guides/TROUBLESHOOTING.md)
- **Add a feature** → Check [features/](features/) for existing patterns
- **Understand the architecture** → [ARCHITECTURE.md](ARCHITECTURE.md)
- **Follow code standards** → [architecture/STYLE_GUIDE.md](architecture/STYLE_GUIDE.md) and [architecture/DESIGN_PRINCIPLES.md](architecture/DESIGN_PRINCIPLES.md)
- **Research a topic** → [research/](research/)
- **Check data schema** → [data/](data/)
- **Set up analytics funnel** → [analytics/ACTIVATION_FUNNEL.md](analytics/ACTIVATION_FUNNEL.md)

---

## 📊 **Documentation Stats**

- **Setup Guides**: 5 files
- **Developer Guides**: 7 files
- **Architecture**: 5+ files (includes MIDDLEWARE.md)
- **Features**: 6 files (consolidated from 13)
- **Analytics**: 1 file
- **Research**: 7 files
- **Reference**: 6 files
- **Quick Start**: 3 files
- **Archives**: 50+ files preserved

---

**Last Updated**: January 2025
**Status**: Complete reorganization by purpose
**Next Review**: February 2025
