# Supabase skills (absorbed inline)

Source: https://github.com/supabase/agent-skills (MIT, Copyright (c) 2026 Supabase). Copied as-is, not installed via `npx skills` (avoids provider folders such as `.agents/`).

- `supabase/SKILL.md` - read BEFORE any Supabase task (auth, RLS, Edge Functions, MCP, migrations, debugging). Check the changelog/docs first; verify every fix; enable RLS on exposed schemas; never use `user_metadata` for authorization; never expose service-role/secret keys.
- `supabase-postgres-best-practices/SKILL.md` - read BEFORE any schema, migration, index, RLS policy or SQL change. Open only the `references/<prefix>-*.md` files relevant to the task (RTK bounded reading).

Project notes: skill-feedback upload to the upstream repo requires explicit user permission. Update by re-copying from upstream.