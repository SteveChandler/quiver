# Agent Roster

Specialist subagents for the Quiver project. The main session is a coordinator — always delegate.

Agents sourced from [agency-agents](https://github.com/msitarzewski/agency-agents), customized for Quiver's stack.
Design skills from [Impeccable](https://github.com/cigar/www-impeccable).

## Quick Routing

| Task | Agent |
|------|-------|
| **Orchestration** | `agents-orchestrator` |
| **Frontend** — Next.js, React, UI, Tailwind | `engineering-frontend-developer` |
| **Backend** — API Routes, Server Actions, Supabase | `engineering-backend-architect` |
| **Database** — Schema, RLS, Migrations, PostGIS | `engineering-database-optimizer` |
| **Code Review** (end every task here) | `engineering-code-reviewer` |
| **Security** — RLS, Auth, Rate Limiting | `engineering-security-engineer` |
| **DevOps** — Vercel, Supabase, CI/CD | `engineering-devops-automator` |
| **Mobile** — Capacitor + Expo/React Native | `engineering-mobile-app-builder` |
| **Architecture** — System Design | `engineering-software-architect` |
| **E2E / QA** | `testing-reality-checker` |
| **SEO** | `marketing-seo-specialist` |
| **Growth** | `marketing-growth-hacker` |
| **Content / Social** | `marketing-content-creator` |
| **Project Planning** | `project-manager-senior` |
| **Incident Response** | `engineering-incident-response-commander` |
| **UI Design** | `design-ui-designer` |
| **UX Architecture** | `design-ux-architect` |
| **Mobile — React Native** | Work in `../quiver-native` repo with its own CLAUDE.md |

## Customized Agents (Quiver-Specific)

These 9 agents have been rewritten with Quiver stack knowledge, patterns, and critical rules:

| Agent | What it knows |
|-------|--------------|
| `engineering-frontend-developer` | Next.js 16, useDataFetcher, retro-dark theme, Framer Motion springs, Mapbox GL |
| `engineering-backend-architect` | withAuth, withAuthenticatedAction, Supabase RLS, migration safety, forecast_at |
| `engineering-code-reviewer` | All Quiver gotchas (coordinate naming, profile_id, forecast_at), same-commit rule |
| `engineering-database-optimizer` | PostgreSQL 15+ with PostGIS, RLS policies, Supabase pooler, migration protocol |
| `engineering-mobile-app-builder` | Capacitor 8, Expo 55, Tamagui, Reanimated 4, Colors tokens, haptics |
| `agents-orchestrator` | Full routing map, quality gates, pre-merge checklist |
| `engineering-security-engineer` | Supabase Auth, RLS, withFullProtection, Zod validation, threat model |
| `engineering-devops-automator` | Vercel, Supabase migrations, GitHub Actions, Sentry, EAS Build |
| `testing-reality-checker` | Playwright E2E patterns, same-commit rule, blast radius, quality targets |

## Design Skills (Impeccable)

Invoke as `/skill` commands for design-quality workflows:

| Skill | Purpose |
|-------|---------|
| `/frontend-design` | Build distinctive UI (anti-AI-slop aesthetic) |
| `/critique` | UX design critique with actionable feedback |
| `/polish` | Final quality pass — alignment, spacing, consistency |
| `/animate` | Purposeful animations and micro-interactions |
| `/audit` | Comprehensive interface quality audit |
| `/adapt` | Responsive design across devices/platforms |
| `/bolder` | Amplify safe/boring designs |
| `/quieter` | Tone down aggressive designs |
| `/clarify` | Improve UX copy, error messages, labels |
| `/colorize` | Add strategic color to monochromatic interfaces |
| `/delight` | Add personality and joy |
| `/distill` | Strip designs to their essence |
| `/extract` | Extract reusable components into design system |
| `/harden` | Improve error handling, i18n, edge cases |
| `/normalize` | Ensure design system consistency |
| `/onboard` | Design onboarding flows and empty states |
| `/optimize` | Performance optimization for interfaces |

## All Agent Categories

### Customized for Quiver (9)
See table above.

### Design (8)
`design-brand-guardian` · `design-image-prompt-engineer` · `design-inclusive-visuals-specialist` · `design-ui-designer` · `design-ux-architect` · `design-ux-researcher` · `design-visual-storyteller` · `design-whimsy-injector`

### Engineering (17)
`engineering-ai-engineer` · `engineering-autonomous-optimization-architect` · `engineering-backend-architect` ★ · `engineering-code-reviewer` ★ · `engineering-data-engineer` · `engineering-database-optimizer` ★ · `engineering-devops-automator` ★ · `engineering-frontend-developer` ★ · `engineering-git-workflow-master` · `engineering-incident-response-commander` · `engineering-mobile-app-builder` ★ · `engineering-rapid-prototyper` · `engineering-security-engineer` ★ · `engineering-senior-developer` · `engineering-software-architect` · `engineering-sre` · `engineering-technical-writer`

★ = Customized for Quiver

### Game Development (19)
`game-audio-engineer` · `game-designer` · `level-designer` · `narrative-designer` · `technical-artist` · `godot-gameplay-scripter` · `godot-multiplayer-engineer` · `godot-shader-developer` · `roblox-avatar-creator` · `roblox-experience-designer` · `roblox-systems-scripter` · `unity-architect` · `unity-editor-tool-developer` · `unity-multiplayer-engineer` · `unity-shader-graph-artist` · `unreal-multiplayer-architect` · `unreal-systems-engineer` · `unreal-technical-artist` · `unreal-world-builder`

### Marketing (26)
`marketing-app-store-optimizer` · `marketing-baidu-seo-specialist` · `marketing-bilibili-content-strategist` · `marketing-book-co-author` · `marketing-carousel-growth-engine` · `marketing-china-ecommerce-operator` · `marketing-content-creator` · `marketing-cross-border-ecommerce` · `marketing-douyin-strategist` · `marketing-growth-hacker` · `marketing-instagram-curator` · `marketing-kuaishou-strategist` · `marketing-linkedin-content-creator` · `marketing-livestream-commerce-coach` · `marketing-podcast-strategist` · `marketing-private-domain-operator` · `marketing-reddit-community-builder` · `marketing-seo-specialist` · `marketing-short-video-editing-coach` · `marketing-social-media-strategist` · `marketing-tiktok-strategist` · `marketing-twitter-engager` · `marketing-wechat-official-account` · `marketing-weibo-strategist` · `marketing-xiaohongshu-specialist` · `marketing-zhihu-strategist`

### Product (4)
`product-behavioral-nudge-engine` · `product-feedback-synthesizer` · `product-sprint-prioritizer` · `product-trend-researcher`

### Project Management (6)
`project-management-experiment-tracker` · `project-management-jira-workflow-steward` · `project-management-project-shepherd` · `project-management-studio-operations` · `project-management-studio-producer` · `project-manager-senior`

### Specialized (7)
`agents-orchestrator` ★ · `lsp-index-engineer` · `specialized-cultural-intelligence-strategist` · `specialized-developer-advocate` · `specialized-document-generator` · `specialized-mcp-builder` · `specialized-model-qa`

### Strategy (16 files)
`nexus-strategy` · coordination (`agent-activation-prompts` · `handoff-templates`) · playbooks (phases 0-6) · runbooks (4 scenarios)

### Support (6)
`support-analytics-reporter` · `support-executive-summary-generator` · `support-finance-tracker` · `support-infrastructure-maintainer` · `support-legal-compliance-checker` · `support-support-responder`

### Testing (8)
`testing-accessibility-auditor` · `testing-api-tester` · `testing-evidence-collector` · `testing-performance-benchmarker` · `testing-reality-checker` ★ · `testing-test-results-analyzer` · `testing-tool-evaluator` · `testing-workflow-optimizer`

## Workflow

```
@agents-orchestrator → specialist agents → @engineering-code-reviewer for QA
```

- **Multi-step task**: `@agents-orchestrator` FIRST, then follow its routing
- **Single-domain task**: Route directly to the specialist
- **Unsure**: Ask `@agents-orchestrator`
- **"This is simple, I'll just..."**: STOP. Use an agent. Always.
- **UI work**: `/frontend-design` → specialist → `/polish` + `/critique`
