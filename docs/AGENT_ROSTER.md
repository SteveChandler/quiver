# Agent Roster

Specialist subagents available for the Quiver project. The main session is a coordinator — always delegate to these agents.

## Routing

| Task | Agent |
|------|-------|
| Orchestration & Planning | `tech-lead-orchestrator` |
| Next.js / App Router / React / SSR / SEO | `nextjs-developer` |
| Supabase / Schema / RLS / Migrations | `supabase-db-expert` |
| Full-Stack Features / Growth | `fullstack-engineer` |
| Performance | `performance-optimizer` |
| Code Review (finish every task here) | `code-reviewer` |
| E2E Testing | `test-automator` |
| Code Archaeology / Impact Analysis | `code-archaeologist` |
| Refactoring / Tech Debt | `refactoring-specialist` |
| Architecture Review | `architect-reviewer` |
| Design Review | `quiver-design-reviewer` |
| ML / Data Science (Python) | `ml-data-expert` |
| Team Configuration | `team-configurator` |
| Mobile — Capacitor (this repo) | `fullstack-engineer` |
| Mobile — React Native (`quiver-native`) | Work in `../quiver-native` repo with its own CLAUDE.md |

## Voltagent Fallback

For generic tasks not covered by Quiver agents, route to voltagent plugins:

| Task | Voltagent Agent |
|------|----------------|
| API Design (generic) | `voltagent-core-dev:api-designer` |
| Backend (non-Supabase) | `voltagent-core-dev:backend-developer` |
| Frontend (non-Next.js) | `voltagent-core-dev:frontend-developer` |
| UI/Visual Design | `voltagent-core-dev:ui-designer` |
| Tailwind CSS | `voltagent-core-dev:frontend-developer` |
| Documentation | `voltagent-biz:technical-writer` |
| QA Strategy | `voltagent-biz:scrum-master` |
| Data Analysis | `voltagent-biz:business-analyst` |

## Workflow

```
@tech-lead-orchestrator → specialist agents → @code-reviewer for QA
```

- **Multi-step task**: `@tech-lead-orchestrator` FIRST, then follow its routing map
- **Single-domain task**: Use the specialist agent directly
- **Unsure which agent**: Ask `@tech-lead-orchestrator` anyway
- **"This is simple, I'll just..."**: STOP. Use an agent. Always.