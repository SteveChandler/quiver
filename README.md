## Quiver

Community-driven surf app (Next.js 14 + Supabase + Tailwind + shadcn/ui).

For architecture, development standards, and navigation, see:

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Top-level overview and index to detailed docs
- [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) — Development troubleshooting guide
- [docs/MOBILE_LOCAL_DEV.md](./docs/MOBILE_LOCAL_DEV.md) — Mobile development with local tunnels (bypasses Vercel)

Key directories:

- `app/`, `components/`, `hooks/`, `lib/`, `supabase/`, `types/`, `test-utils/`, `e2e/`

Growth focus: social sharing, session photos, viral mechanics, community features.

### Supabase Access (Remote → Local)

Project ref: `vawdnbbgawichorsjiwe` (quiverDB). Do not commit tokens.

```bash
# Auth & link
export SUPABASE_ACCESS_TOKEN="<YOUR_PAT>"
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref vawdnbbgawichorsjiwe

# Pull schema (preferred)
supabase db pull
# If pull errors:
supabase db pull --schema public

# Direct dump fallback
supabase db dump --schema public --file supabase/migrations/REMOTE_SCHEMA.sql

# Reset local and start
supabase db reset --local
supabase start

# Regenerate types (optional)
npx supabase gen types typescript --project-id vawdnbbgawichorsjiwe > types/database.ts
```

Troubleshooting:

- SCRAM/WRONG PASSWORD: re-login with a fresh PAT and re-link.
- schemainspect TypeError: use `--schema public` or direct dump fallback.
- Full local reset:

```bash
supabase stop
docker ps -a --format '{{.Names}}' | grep -E '^supabase-' | xargs -r docker rm -f
docker volume ls --format '{{.Name}}' | grep -E '^supabase' | xargs -r docker volume rm -f
rm -rf supabase/.branches supabase/.temp supabase/.shadow
```
