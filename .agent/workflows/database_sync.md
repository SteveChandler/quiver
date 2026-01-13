---
description: Sync Supabase types and reset local DB
---

# Database Sync

Use this when you need to pull the latest schema from the remote Supabase project or reset your local environment.

## Steps

1. Login (if needed)
2. Link project
3. Pull schema
4. Reset local DB

```bash
# Ensure you are logged in
supabase login

# Link (if not linked)
supabase link --project-ref vawdnbbgawichorsjiwe

# Pull latest schema
supabase db pull --schema public

# Reset local database (WARNING: Deletes local data)
supabase db reset
```
