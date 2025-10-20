# Quiver Documentation

This directory contains the essential documentation for the Quiver surf app, focused on current architecture, design principles, and development patterns.

## 📚 **Core Documentation**

### **Architecture & Strategy**

- **`ARCHITECTURE_REVIEW.md`** - Comprehensive system overview, current status, and growth strategy
- **`MOBILE_LAUNCH_ARCHITECTURE.md`** - iOS/Android launch plan via Capacitor with native value and CI/CD
- **`prd.txt`** - Product requirements document with current state and roadmap
- **`DESIGN_PRINCIPLES.md`** - Core design philosophy and technical patterns

### **Development Standards**

- **`STYLE_GUIDE.md`** - Brand identity, UI/UX standards, and design tokens
- **`DRY_COMPONENT_USAGE.md`** - DRY component patterns and usage examples
- **`CURSOR_AGENTS.md`** - Development workflow and agent configurations
- **`TROUBLESHOOTING.md`** - Development troubleshooting guide and common issues
- **`E2E_TEST_PLAN.md`** - End-to-end testing strategy and patterns
- **`ACCESSIBILITY_TESTING.md`** - WCAG compliance and accessibility standards

### **Technical Reference**

- **`SCHEMA_REFERENCE.sql`** - Complete database schema documentation
- **`MOTION_DESIGN_REVIEW.md`** - Motion design analysis and implementation guide
- **`REALTIME_OPTIMIZATION_GUIDE.md`** - Supabase realtime performance best practices
- **`DATABASE_SECURITY_FIXES_2025_10.md`** - Security enhancements and RLS optimization reference

### **Feature Guides**

- **`GAMIFICATION.md`** - Gamification system (XP, badges, levels) - canonical reference
- **`NPC_DAILY_ACTIVITY_GUIDE.md`** - Automated NPC content seeding system
- **`NOTIFICATION_TESTING_GUIDE.md`** - Push/email/in-app notification testing
- **`PUSH_NOTIFICATIONS_SETUP.md`** - Firebase FCM setup for mobile and web
- **`IOS_APP_RELEASE_STEPS.md`** - Step-by-step iOS App Store submission guide

### **Research & Context**

- **`global-surfing-hubs.md`** - Global surf community research for future expansion

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

## 🔄 **Recent Cleanup**

**January 2025 (Latest)**: Major docs folder consolidation from 56 → 21 files (63% reduction):

- **Removed 23 completed implementation guides**: Analytics tracking, beach content refactor, intel setup, monitoring guides, morning intel, NPC seeding deliverables, SEO implementation, motion implementation
- **Removed 5 historical retention analysis docs**: Oct 2025 user behavior diagnostics and retention discussions (insights captured in current strategy)
- **Removed 5 one-time setup guides**: Android build steps, Vercel env setup, deploy notifications, app store content, quick test guide
- **Removed 3 outdated specs**: Original gamification spec, notifications architecture draft, server/client patterns
- **Consolidated mobile dev guides**: 4 files → 1 comprehensive MOBILE_LAUNCH_ARCHITECTURE.md
- **Consolidated notification guides**: 5 files → 2 essential references
- **Kept iOS release guide**: Essential reference for App Store submissions
- **Moved data files**: CSV webcam data to `scripts/data/` directory
- **Result**: Streamlined from 56 to 21 focused, actively-maintained documentation files

**October 2025**: Major repository cleanup removing stale documentation and artifacts:

- Removed 44 files tracked by git (completion reports, implementation summaries, temporary test scripts)
- Removed 3 generated test artifact directories (coverage/, playwright-report/, test-results/)
- Removed docs/consolidation/ planning directory (12 files from Sept 2025)
- Removed 7 ETL/imported data files from docs/
- Removed disabled test files and build artifacts
- **Result**: Cleaner repository focused on active development; all history preserved in git

---

**Last Updated**: January 2025  
**Status**: Focused on 21 essential, actively-maintained documentation files
