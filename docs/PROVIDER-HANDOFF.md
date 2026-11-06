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
- All published forms are visible to invited Users by default; a form email allowlist restricts access when populated.
- Mobile-first User form experience; desktop-focused Admin workspace; installable PWA.
- No paid app-store distribution or native packages in current plan.
- Next.js/React/TypeScript static export on GitHub Pages; Supabase backend.
- Complete planned application released as beta; no MVP phase.
- All Admins receive new ticket email. First Admin to claim becomes owner; other Admins are notified. Owner may request helper Admin; explicit transfer changes owner.
- Company Google Workspace Shared Drive stores files under `Forms MESRC/{user_id}/{submission_id}`. Hard maximum is 1 GiB per file. Supabase stores metadata only.
- Maintenance-only Settings provide English setup help via information icons; Admin has no access to Settings.

## Important constraints

- GitHub Pages has no Next.js server runtime. Use static export; move privileged operations to Supabase Edge Functions.
- Never expose service-role keys, Google credentials, SMTP credentials or private data in public source/build output.
- RLS is the security boundary for database data; UI route guards are not security.
- Private Drive access must be mediated by authenticated backend authorization. Never use public Drive sharing links.
- Google Workspace administrator must authorize the Drive API integration and Shared Drive access.

## Setup-time confirmations

These require company access/policy and do not authorize redesign of agreed product behavior:

- Workspace IT-approved Google integration identity and API scopes.
- Actual Shared Drive quota; attachment MIME allowlist and retention/deletion policy.
- Approved email provider/sender and sending limits.
- Beta URL/custom domain and GitHub Pages base path.
- Appeal decision authority and whether users can respond to `Needs Information`.
- Data retention, backup/export ownership and draft/offline policy.
- Initial service list and service administration authority.

Use conservative defaults and ask explicitly if implementation requires a new product decision.

## First task for the next provider

Do not start by implementing product screens. First inspect the existing workspace and report its current state. Then perform Phase 0 of `docs/DEVELOPMENT-PLAYBOOK.md`: scaffold a static-export-compatible Next.js PWA, configure GitHub Pages deployment, build a placeholder, verify nested routes and confirm the public bundle contains no secrets. Do not configure real Google/Supabase credentials until the Maintenance setup flow and RLS foundation are ready.

## Handoff status

The planning package is ready. Application source code and external provider accounts are not yet configured. Preserve the product decisions above and continue from Phase 0.
