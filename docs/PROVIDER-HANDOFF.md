# Provider Handoff — Forms MESRC

## Start here

Read these files in order:

1. `AGENTS.md`, `rules.md` and `.Mcore/Feature/single-agent-system/SYSTEM-MASTER.md` for workspace workflow rules.
2. `docs/PRD.md` for agreed product behavior.
3. `docs/TECHNICAL-DESIGN.md` for architecture, data, security and flows.
4. `docs/DEVELOPMENT-PLAYBOOK.md` for build phases and exit criteria.
5. `docs/MAINTENANCE-SETUP.md` for company operator setup.
6. `.Mcore/users/moon/agents/kid/memory.json` and `diary.json` for prior decisions and handoff history.

## Product owner decisions already confirmed

- Product name: Forms MESRC.
- One company with multiple services/operations.
- All user-facing UI and system-generated emails are English; Moon may plan in Malay.
- Roles: Maintenance, Admin and User. Maintenance users have equal authority and may invite more Maintenance users. Admin may invite Users only.
- Email OTP, invite-only access; no passwords and no public self-registration.
- **First-Time Setup Wizard (`/setup/`)**: Before anyone signs in for the first time, the system runs a 3-step wizard: (1) claim first Maintenance email, (2) verify OTP to activate the first Maintenance profile and permanently lock public bootstrap, (3) configure company Google Workspace Shared Drive settings with `i` info-icon guides.
- All published forms are visible to invited Users by default; a form email allowlist restricts access when populated (enforced at RLS).
- Mobile-first User form experience; desktop-focused Admin workspace; installable PWA.
- No paid app-store distribution or native packages in current plan.
- Next.js/React/TypeScript static export in `apps/web` deployed to GitHub Pages; Supabase backend (`uvjwepsawrbrhpywabdu`).
- Complete planned application released as beta; no MVP phase.
- All Admins receive new ticket email. First Admin to claim becomes owner; other Admins are notified. Owner may request helper Admin; explicit transfer changes owner.
- Company Google Workspace Shared Drive stores files under `Forms MESRC/{user_id}/{submission_id}`. Hard maximum is 1 GiB per file. Supabase stores metadata only.
- Maintenance-only Settings provide English setup help via information icons; Admin has no access to Settings.

## Current implementation status (2026-11-06)

- **Phase 0 (Complete):** Monorepo layout with Next.js 16 + React 19 + TypeScript static export in `apps/web/`, GitHub Actions Pages workflow (`.github/workflows/pages.yml`), PWA manifest/icons/safe service worker, and bundle secret scanner (`apps/web/scripts/verify-export.mjs`).
  - Public GitHub repo: `https://github.com/MoonWIRaja/forms-mesrc`
  - Live GitHub Pages URL: `https://moonwiraja.github.io/forms-mesrc/`
  - GitHub Actions variables configured: `NEXT_PUBLIC_BASE_PATH=/forms-mesrc`, `NEXT_PUBLIC_SUPABASE_URL=https://uvjwepsawrbrhpywabdu.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tOTyPAnkxDdNP9UDOBIbWA_JzoPEL3t`.
- **Phase 1 (Complete):** Applied `supabase/migrations/20261106000000_phase1_baseline.sql` and `supabase/seed.sql` to remote Supabase project `uvjwepsawrbrhpywabdu`. Verified with `supabase db lint` (0 errors) and `supabase/tests/rls.sql`.
- **Phase 2 (Complete):** Applied `supabase/migrations/20261106010000_phase2_wizard_otp_settings.sql` to remote Postgres. Built and deployed `/setup/` (3-step First-Time Setup Wizard), `/sign-in/`, `/invite/accept/`, `/maintenance/`, `/maintenance/settings/` (write-only `pgcrypto`-encrypted Google Drive secret storage + `i` info popovers), and `/admin/` invitation manager.
- **Phase 3 (Complete):** Applied `supabase/migrations/20261106020000_phase3_services_forms_submissions.sql` to remote Postgres. Enforced immutable published `form_versions` via trigger, email allowlist at RLS (`private.can_user_access_form`), and server-validated submissions (`submit_form_response`). Built and deployed `/admin/forms/` (Visual Form Builder with 3 templates, 12 field types, drag-and-drop canvas, property inspector, allowlist, phone/desktop preview), `ServiceManager` in `/admin/`, `/forms/` catalog, and `/forms/fill/` renderer with timer and draft saving.

## Next task for the incoming provider

Continue directly with **Phase 4 (Google Drive files)** and **Phase 5 (Appeals and complaint tickets)** in `docs/DEVELOPMENT-PLAYBOOK.md`:

1. **Phase 4:** Add migration & Edge Function / RPC support for `submission_files` metadata (`Forms MESRC/{user_id}/{submission_id}`, 1 GiB max validation, authorized upload/download mediation using the stored `private.integration_secrets` Google Drive configuration).
2. **Phase 5:** Add migration & RLS for `appeal_reviews`, `tickets`, `ticket_help_requests`, `ticket_helpers`, `ticket_events`, and `email_outbox`. Implement atomic first-Admin **Take Ticket** claim, **Request Help** acceptance/decline, explicit ownership transfer, and English UI screens for User and Admin appeals/tickets.
3. **Phase 6 & 7:** Realtime subscriptions, audit log viewer (`/maintenance/audit`), and beta release hardening.