# Quiver Documentation

This directory contains the essential documentation for the Quiver surf app, focused on current architecture, design principles, and development patterns.

## 📚 **Core Documentation**

### **Architecture & Strategy**

- **`ARCHITECTURE_REVIEW.md`** - Comprehensive system overview, product vision, current status, and growth strategy
- **`ARCHITECTURE.md`** - Top-level architecture index with mobile architecture, stack overview, and pattern references
- **`DESIGN_PRINCIPLES.md`** - Core design philosophy, technical patterns, and motion design system

### **Development Standards**

- **`STYLE_GUIDE.md`** - Brand identity, UI/UX standards, design tokens, and DRY component patterns
- **`CLAUDE.md`** - Claude Code contributor guide and development workflow
- **`CURSOR_AGENTS.md`** - Cursor agent configurations and MCP integration
- **`TROUBLESHOOTING.md`** - Development troubleshooting guide and common issues
- **`E2E_TEST_PLAN.md`** - End-to-end testing strategy, notification testing, and accessibility testing
- **`SETUP.md`** - Development environment setup guide

### **Technical Reference**

- **`SCHEMA_REFERENCE.sql`** - Complete database schema documentation
- **`REALTIME_OPTIMIZATION_GUIDE.md`** - Supabase realtime performance best practices

### **Feature Guides**

- **`GAMIFICATION.md`** - Gamification system (XP, badges, levels, NPC daily activity) - canonical reference
- **`PUSH_NOTIFICATIONS_SETUP.md`** - Firebase FCM setup for mobile and web
- **`IOS_RELEASE_GUIDE.md`** - Complete iOS App Store submission guide
- **`TUNNEL_AUTOMATION_SUMMARY.md`** - Mobile development tunnel automation with quick start guide

### **Design & Layout**

- **`BEACH_PAGE_DESIGN.md`** - Beach detail page design with AllTrails-inspired layout and implementation status
- **`alltrails_layout_spec.md`** - AllTrails technical layout reference

### **Research & Context**

- **`FORECASTING_RESEARCH.md`** - Surf forecasting research and improvements (archived)
- **`global-surfing-hubs.md`** - Global surf community research for future expansion
- **`learned_from_reddit.md`** - Raw findings from Reddit surf community research
- **`reddit_guidance.md`** - Implementation guide based on Reddit feedback

### **Deployment & Operations**

- **`DEPLOYMENT_CHECKLIST.md`** - Production deployment checklist
- **`CHANGELOG.md`** - Complete change history and recent updates
- **`setup-github-secrets.md`** - GitHub secrets configuration guide
- **`CODEx_SETUP_REPORT.md`** - CodeX setup report

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

**January 2025 (Latest)**: Aggressive documentation consolidation from 42 → 26 files (38% reduction):

**Deleted & Merged (16 files):**
- **Product docs** (3): prd.txt, Quiver_TechSpec.md, Quiver_Implementation_Plan.md → merged into ARCHITECTURE_REVIEW.md
- **iOS docs** (1): IOS_RELEASE_README.md → merged into IOS_RELEASE_GUIDE.md (renamed from IOS_APP_RELEASE_STEPS.md)
- **Mobile arch** (1): MOBILE_LAUNCH_ARCHITECTURE.md → merged into ARCHITECTURE.md
- **Component patterns** (1): DRY_COMPONENT_USAGE.md → merged into STYLE_GUIDE.md
- **Testing guides** (2): NOTIFICATION_TESTING_GUIDE.md, ACCESSIBILITY_TESTING.md → merged into E2E_TEST_PLAN.md
- **Design docs** (1): MOTION_DESIGN_REVIEW.md → merged into DESIGN_PRINCIPLES.md
- **Tunnel docs** (1): TUNNEL_QUICK_START.md → merged into TUNNEL_AUTOMATION_SUMMARY.md
- **Research** (1): forecasting-research.md (superseded by forecast-improvements-research.md → renamed to FORECASTING_RESEARCH.md)
- **Beach docs** (1): quiver_beach_detail_refactor.md → implementation summary added to BEACH_PAGE_DESIGN.md
- **Outdated reports** (3): TEST_SUMMARY.md, BEACH_DETAIL_TEST_BUGS.md, DATABASE_SECURITY_FIXES_2025_10.md
- **Gamification** (1): NPC_DAILY_ACTIVITY_GUIDE.md → merged into GAMIFICATION.md

**Result:** Streamlined to 26 focused files (25 .md + 1 .sql) with all content preserved

**Previous (January 2025)**: Major docs folder consolidation from 56 → 42 files (25% reduction):
- Removed 23 completed implementation guides
- Removed 5 historical retention analysis docs
- Removed 5 one-time setup guides
- Removed 3 outdated specs
- Consolidated mobile and notification guides

---

**Last Updated**: January 2025
**Status**: Focused on 26 essential, actively-maintained documentation files
