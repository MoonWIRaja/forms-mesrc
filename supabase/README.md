# Supabase (Phase 1 baseline)

Versioned SQL for the Forms MESRC backend. **Status: applied and RLS-verified on remote project `uvjwepsawrbrhpywabdu` (2026-11-06).**

- `migrations/20261106000000_phase1_baseline.sql` - profiles, roles, services, invites, settings, audit; RLS on every table; invite-only profile creation; one-time Maintenance bootstrap.
- `seed.sql` - synthetic data only.
- `tests/rls.sql` - role-isolation checks (rolls back). Run on a LOCAL or DEV database only.

## Apply (dev project first)
1. Review the migration. Never run schema changes from the browser.
2. Apply with the Supabase MCP or CLI to the **dev** project (`supabase db push`), then run `tests/rls.sql`.
3. Register the first Maintenance email once in the SQL editor: `select private.set_bootstrap_maintenance_email('you@company.example');` then sign in with that email via OTP.
4. In Auth settings: email OTP on, password sign-in off, redirect URLs set to the Pages URL, custom SMTP configured. Invites are created by Edge Functions (Phase 2).

Rules: no service-role key in the repo or frontend; use `app_metadata`/`profiles.role`, never `user_metadata`, for authorization.