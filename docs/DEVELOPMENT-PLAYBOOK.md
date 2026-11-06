# Beta Development Playbook

## Purpose

Build the complete Forms MESRC application and release it to invited beta users. There is no separate MVP. Use the PRD and Technical Design as the agreed behavior; raise conflicts before coding rather than silently changing decisions.

## Work rules

- User-facing product and email copy is English.
- Roles are Maintenance, Admin and User. Maintenance peers have equal authority.
- GitHub Pages is the static frontend host; Supabase provides backend services; company Google Workspace Shared Drive stores attachments.
- Never commit secrets, production data or credentials. Public repository is expected.
- Follow workspace MemoryCore pre-change/post-change logging and Harness2 validation requirements in `AGENTS.md` and `rules.md` for code changes.
- Keep changes reviewable and update docs when a product decision changes.

## Build sequence

### Phase 0 — Repository and deployment foundation

- Inspect the repository and carry forward existing work; do not replace files blindly.
- Create Next.js + React + TypeScript app using static-export-compatible architecture.
- Establish formatting, lint/typecheck/build commands, route structure and accessible design tokens.
- Add GitHub Actions Pages deployment with protected deployment branch and correct base path.
- Add public environment variables for Supabase URL and publishable key only.
- Add PWA manifest/icons/install behavior and safe service-worker policy.
- Demonstrate that public site loads and nested routes refresh successfully.

**Exit:** repeatable local build and GitHub Pages static deployment; no secrets in generated bundle.

**Phase 0 status (2026-11-06): complete.**

- Repository: https://github.com/MoonWIRaja/forms-mesrc (public). Live beta placeholder: https://moonwiraja.github.io/forms-mesrc/
- Layout: app in `apps/web` (Next.js 16, React 19, TypeScript, static export, `trailingSlash`); docs in `docs/`; workflow in `.github/workflows/pages.yml`. Keep the repo root minimal; new apps/packages go under `apps/` or `packages/`.
- Commands (run in `apps/web`): `npm run check` = lint + typecheck + build + `verify:export` (route files and secret-pattern scan of `out/`).
- Verified: CI build/deploy passed; live routes `/`, `/sign-in/`, `/maintenance/settings/`, manifest, service worker and icons return 200; unknown route returns 404. `npm audit --omit=dev` reports 0 vulnerabilities (moderate findings are dev-only lint tooling).
- Placeholders (GitHub Actions variables): `NEXT_PUBLIC_BASE_PATH=/forms-mesrc` (change when URL/custom domain changes), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No real Supabase, Google or SMTP credentials connected.
- Not yet done: branch protection on `main`, PWA install test on a real device, real branding icons.
### Phase 1 — Supabase environments and security baseline

- Create development and beta Supabase projects when available.
- Add versioned SQL migrations for profiles, roles, services, invites, settings and audit.
- Enable RLS on every exposed table from creation.
- Add role/profile bootstrap procedure for first Maintenance account; no public self-promotion.
- Write synthetic seed data and authorization checks.
- Configure Auth redirects, SMTP and Edge Function secret storage plan.

**Exit:** test accounts prove role isolation and RLS rules; no production data.

**Phase 1 status (2026-11-06): database schema & RLS verified on remote.**

- Applied `supabase/migrations/20261106000000_phase1_baseline.sql` and `supabase/seed.sql` to remote project `uvjwepsawrbrhpywabdu` via `supabase db push --remote`.
- Verified: `supabase db lint --remote` reported 0 schema errors; `supabase/tests/rls.sql` executed and passed all 7 role-isolation, bootstrap, invite-only, and privilege-escalation checks against the live Postgres instance.
- Remaining setup-time items (require Dashboard / project keys): set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in GitHub Actions variables, register first Maintenance email (`select private.set_bootstrap_maintenance_email(...)`), and configure Auth OTP/SMTP/redirects in Supabase Dashboard.
### Phase 2 — Invitations, OTP and Maintenance setup

- Build invite management with exact role matrix and revocation/expiry.
- Implement invite-gated OTP with throttling and abuse protection.
- Build English login/invite screens and recoverable errors.
- Build Maintenance Settings with information-icon instructions, validation status and safe credential handling.
- If project secrets cannot be securely written by a protected function, provide guided Dashboard setup plus connection checks; never create an unsafe secret entry endpoint.

**Exit:** end-to-end invite/login works for all roles; uninvited emails cannot gain a session.

### Phase 3 — Company services and form system

- Implement service management and user-service association.
- Implement form schema/version database model and allowlist RLS.
- Build form catalog and responsive renderer.
- Build drag/drop canvas, node tree, property editor, templates and preview.
- Implement draft/publish/archive and immutable published versions.
- Implement submission timer, validation, save draft policy and submission list/detail.

**Exit:** Admin creates/publishes versioned forms; eligible User submits; unauthorized email is denied at RLS.

### Phase 4 — Google Drive files

- Confirm Workspace IT-approved Shared Drive and API identity.
- Set up private `Forms MESRC` root folder and store its ID server-side.
- Implement resumable uploads capped at 1 GiB, progress/retry/finalize, MIME/type validation, private download and delete authorization.
- Add metadata rows, audit events, orphan cleanup and quota visibility.

**Exit:** allowed users can upload/download; other users cannot access file; oversized or untrusted files are rejected.

### Phase 5 — Appeals and complaint tickets

- Implement appeal review states, reasons, decision history and User status view.
- Implement ticket creation and all-Admin new-ticket email.
- Implement atomic `Take Ticket`, owner email to other Admins, normal status progression/reopen.
- Implement Request Help, accept/decline, scoped helper access and explicit transfer.
- Implement transactional email outbox, retries, idempotency and delivery status.

**Exit:** no double claim; correct ownership and notifications; ticket transitions fully audited.

### Phase 6 — Realtime administration and operational views

- Build Admin/Maintenance dashboards with pagination, filters, search and service views.
- Subscribe to scoped realtime events; reconcile by refetch on reconnect.
- Implement submission/ticket detail, user management and audit views.
- Ensure User role has no admin/settings navigation or data access.

**Exit:** dashboard updates without manual refresh and no cross-user data leaks.

### Phase 7 — Beta hardening and release

- Verify all beta readiness gates in Technical Design.
- Test Android/iOS installable PWA behavior and desktop browser behavior.
- Test real email delivery, Drive API quota failure, resumable interruption, Supabase limits and recovery.
- Run backup/export and restore drill with synthetic data.
- Prepare known issues, feedback channel, support contacts and rollback steps.
- Deploy beta to invited test group; production expansion is a separate decision.

**Exit:** all planned core flows exist, critical access/security checks pass, operations and rollback are documented.

## Definition of done for each feature

- English UI copy and responsive behavior are complete.
- Loading, empty, error, access-denied and network-loss states are handled.
- RLS/backend authorization is implemented and checked; UI hiding alone is insufficient.
- Audit/email/realtime side effects are idempotent where applicable.
- Relevant checks pass; security-sensitive changes have negative tests.
- Docs and MemoryCore change logs are updated.

## First implementation task

Start Phase 0 after the product owner confirms the final beta URL strategy. First inspect the repository, then scaffold the static Next.js PWA without changing the approved product architecture. Build and deploy a no-secret placeholder to GitHub Pages before adding real integrations.
