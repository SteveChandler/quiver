# Agent Roster

Specialist subagents available for the Quiver project. The main session is a coordinator — always delegate to these agents.

## Routing

| Task | Agent |
|------|-------|
| Orchestration & Planning | `tech-lead-orchestrator` |
| Next.js / App Router / SSR / SEO | `nextjs-developer` |
| React Components / Hooks | `react-nextjs-expert` |
| Supabase / Schema / RLS / Migrations | `supabase-db-expert` |
| API Design | `api-designer` |
| Tailwind Styling | `tailwind-frontend-expert` |
| Performance | `performance-optimizer` |
| Code Review (finish every task here) | `code-reviewer` |
| E2E Testing | `test-automator` |
| Full-Stack Features | `fullstack-engineer` |
| Code Archaeology / Impact Analysis | `code-archaeologist` |
| Refactoring / Tech Debt | `refactoring-specialist` |
| Documentation | `documentation-specialist` |
| Architecture Review | `architect-reviewer` |
| QA Strategy | `qa-expert` |
| Design Review | `quiver-design-reviewer` |
| Data Research | `data-researcher` |
| Mobile — Capacitor (this repo) | `fullstack-engineer` |
| Mobile — React Native (`quiver-native`) | Work in `../quiver-native` repo with its own CLAUDE.md |

## Workflow

```
@tech-lead-orchestrator → specialist agents → @code-reviewer for QA
```

- **Multi-step task**: `@tech-lead-orchestrator` FIRST, then follow its routing map
- **Single-domain task**: Use the specialist agent directly
- **Unsure which agent**: Ask `@tech-lead-orchestrator` anyway
- **"This is simple, I'll just..."**: STOP. Use an agent. Always.
