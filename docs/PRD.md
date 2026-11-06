# Product Requirements Document

## Forms MESRC — Forms, Appeals and Complaint Tickets

**Status:** Product requirements baseline for a complete beta release  
**Product owner:** Moon  
**Product language:** English for all application UI, validation and system email. Planning conversations may be Malay.

## 1. Product overview

Forms MESRC is an invitation-only internal application for one company with multiple services or business operations. It consolidates configurable forms, appeals and complaint tickets in one installable Progressive Web App (PWA). It replaces scattered standalone form links with one employee portal.

Users authenticate with email OTP and see published forms available to them. Admins build forms, review submissions and manage tickets. Maintenance users configure the system and integrations. User form completion is optimized for phones; administration is optimized for desktop. Admin dashboards update in real time.

## 2. Product goals

- Provide one portal across the company's services.
- Let Admins create branded, configurable forms with a visual drag-and-drop builder.
- Organize submissions by form, service, requester, date and status.
- Support appeals with review decisions and status visibility.
- Handle complaints as owned, auditable tickets with clear status progression.
- Invite and authorize users without passwords.
- Keep attachments in the company Google Workspace Drive, outside the relational database.
- Release the complete planned product as a beta; there is no separate MVP scope.

## 3. Roles and invitation authority

| Role | Capabilities |
|---|---|
| **Maintenance** | Full system configuration and administration. Every Maintenance account has equal authority. May invite other Maintenance users, Admins and Users. |
| **Admin** | Manage Users, create/publish forms, review company submissions and appeals, and handle all complaint tickets. HR and complaint handling are not separate roles. May invite Users only. |
| **User** | View eligible published forms, submit forms/appeals/complaints, manage own profile and view own submission/ticket status. |

| Inviter | May invite |
|---|---|
| Maintenance | Maintenance, Admin, User |
| Admin | User |
| User | Nobody |

No visitor becomes Maintenance merely by being first to open the site. Initial Maintenance access is bootstrapped through a controlled setup procedure. Role changes are privileged and audited.

## 4. Company services and form visibility

The application supports one company with multiple services/operations, not multiple unrelated companies. Forms and submissions may be associated with one or more services for organization and reporting. A user may belong to multiple services. Service membership does not restrict form visibility by itself.

Every active invited User can see every published form by default. An Admin may add an exact email allowlist to a form. An empty allowlist means all active invited Users can access it; a populated allowlist means only listed email addresses can view and submit. Enforce this rule in database policies, not only in the UI.

## 5. Invitations and passwordless login

1. An authorized inviter creates an invitation with email, role and optional service memberships.
2. The recipient receives an invitation email linking to the application.
3. The recipient enters their invited email and requests an OTP.
4. OTP is sent only for an active, invited account; it expires and is single-use.
5. Supabase Auth verifies the OTP and establishes the session.
6. The application loads the active profile and permissions. Revoked, disabled or uninvited accounts receive no application access.

Invitation links do not grant a session. Apply resend and verification throttles, abuse protection and audit logging. Never store or log raw OTP values or invite tokens.

## 6. Experience and screen requirements

### User mobile experience

- Email/OTP sign-in.
- Available form catalog with service/category filters where useful.
- Responsive form completion, validation, optional save draft and file upload.
- Confirmation and own submission/appeal status.
- Own complaint ticket list, detail and status history.
- Profile and sign out.

Users never see administrative dashboards or another person's submissions/tickets.

### Admin desktop workspace

- Overview of forms, submissions, appeals and tickets with real-time updates.
- Search, filters, pagination and sorting by form, service, requester, date and status.
- Submission details with versioned form answers and authorized attachments.
- Visual form builder, preview and publishing/version controls.
- Appeal review and decisions.
- Ticket queue, atomic claim, status progression, help requests and ownership transfer.
- User invitations and user management, limited to the User role.

### Maintenance workspace

- All Admin capabilities.
- Invite/manage Maintenance, Admin and User accounts.
- Company/service configuration and system settings.
- Google Workspace Drive and email integration setup.
- Integration health checks, audit log, usage/quota indicators.
- Contextual English setup instructions via information icons.

Admin accounts do not see or access Maintenance settings.

## 7. Visual form builder

Admins create forms using templates and draggable canvas nodes with a properties panel. They can configure content, colors, shapes, layout, required state and validation, and preview phone/desktop renderings. Do not permit arbitrary HTML, JavaScript or executable CSS.

Supported field types include short/long text, email, number, date, single choice, multiple choice, dropdown, headings, instructions and sections. File upload is an optional field the Admin can enable; each file has a hard maximum of **1 GiB (1,073,741,824 bytes)**. Actual availability is limited by remaining company Drive quota and policy.

Forms support Draft, Published and Archived states. Editing a published form creates a new immutable version. Existing submissions retain their source version.

## 8. Submissions and appeals

Each submission records form/version, service, requester, answers, optional attachment metadata, start/submission timestamps, status and audit history. Submission answer data is stored in Supabase; binary attachments are stored in Drive.

Appeals use configurable controlled statuses. Baseline: `Submitted → In Review → Needs Information → Approved/Rejected`. Admin decisions and reasons are recorded. The portal displays status to the requester. Whether users may reply to a request for information must be confirmed before implementation of that workflow.

## 9. Complaint tickets

A complaint form submission creates a ticket with a unique ticket number, service, requester, category, priority, status, contact details, optional attachments, owner and timestamped history. Contact with the requester happens outside the application (such as phone or WhatsApp); there is no in-app chat or WhatsApp integration.

Ticket statuses: `Open → In Progress → Resolved → Closed`. All Admins receive an email when a new ticket is created. The first Admin to select **Take Ticket** becomes the owner through an atomic operation and the ticket moves to In Progress. All other Admins are notified by email who claimed it. Only the owner performs normal status progression. Maintenance may override ownership with an audited reason.

The owner can request help from another Admin, optionally with a note. The invited Admin can accept or decline. An accepted helper gets ticket-scoped access but does not become owner. The owner can explicitly transfer ownership. Ticket status changes notify the requester by email. Every claim, help request, response, transfer, reopen and status change is recorded.

## 10. Completion timing

Record form start and submission times automatically and calculate elapsed time. This is elapsed time, not active typing time. Authorized Admins may correct a timing record; correction is audited.

## 11. Email and notifications

Required email categories:

1. Account invitation.
2. Login OTP.
3. New complaint ticket to all Admins.
4. Ticket claim notice to all other Admins, identifying the owner.
5. Help request, acceptance/decline and ownership transfer notifications to involved Admins.
6. Ticket status update to the requester.
7. Optional per-form submission and appeal notifications.

Use Supabase Auth for OTP with custom SMTP. Use a backend Edge Function and retryable outbox for application notifications. Emails contain minimal necessary information and a secure application link; sensitive details remain behind authentication. Provider choice and quotas must be validated before beta.

## 12. Realtime

Use Supabase Realtime for relevant new submissions and ticket changes. RLS must scope events by role and ownership. Reconnects trigger a canonical data refetch; socket events are not the source of truth. Use pagination and filtered queries.

## 13. PWA and hosting

- Frontend: Next.js, React and TypeScript, built as a responsive PWA.
- Host static export on **GitHub Pages using GitHub Actions**.
- Backend: Supabase Auth, Postgres, RLS, Realtime and Edge Functions.
- The PWA can be installed from supported browsers; paid app-store publication and native APK/IPA packages are not targets.
- Use HTTPS, manifest, icons, standalone display and safe service-worker caching. Never cache private API responses, form answers or attachments.
- Static hosting has no Next.js server runtime. No API routes, Server Actions or server-only secrets may be required by the published frontend. Sensitive operations go through Edge Functions.
- Repository may be public, but must never contain credentials, `.env` files or real company data. Only public Supabase URL and publishable key may enter the browser bundle; RLS is mandatory.

## 14. Company Drive attachment storage

Use the company's Google Workspace Shared Drive with an application root folder named **Forms MESRC**. Organize files beneath it by stable application user ID and submission ID, for example `Forms MESRC/{user_id}/{submission_id}/`. Do not use email addresses or user-entered names in folder paths. The Drive folder is private; no “anyone with the link” sharing.

Supabase stores metadata and Drive file IDs, not file bytes. Upload/download/delete goes through authorized backend functions. Large uploads use resumable upload with progress and retry. Maintenance settings provide setup instructions and integration checks. Workspace IT must authorize the app integration and required Drive API scopes.

## 15. Complete beta scope

There is no MVP. The beta target contains the complete product workflows described in this PRD: roles and invites, OTP, service organization, form builder/versioning, submissions, appeals, complaint ownership/help, email notifications, real-time admin workspace, Google Drive attachments, PWA installability, audit and Maintenance configuration. Beta allows iterative improvement and known defects, but does not intentionally omit core workflows.

## 16. Beta acceptance gates

- Invite matrix and OTP eligibility, expiration, revocation and throttling work.
- Users cannot access another user's submissions, tickets or files.
- Form allowlists are enforced at database level.
- Published form versions remain immutable and submissions retain their version.
- Admin ticket claims are atomic; help and ownership changes are auditable.
- Required email events are delivered once or have visible retry/failure status.
- Admin dashboards update without manual refresh and reconcile on reconnect.
- PWA installs on supported platforms; nested route refresh and mobile form workflows work.
- Attachments are private, capped at 1 GiB and accessible only to authorized users.
- No secrets appear in public source or browser bundles.
- Backup/restore, quota monitoring, beta feedback and rollback procedures are documented.

## 17. Setup-time confirmations

These require company account access or operational policy and can be completed during setup without changing the agreed product behavior:

1. Workspace IT grants the app integration access to the company Shared Drive and `Forms MESRC` root folder.
2. Confirm actual Drive quota, allowed file types and retention/deletion policy; per-file cap is fixed at 1 GiB.
3. Confirm service names and whether Admins may add services; design permits it through policy configuration.
4. Confirm the transactional email provider, sender domain and allowed daily volume.
5. Confirm beta URL/custom domain and GitHub Pages repository path.
6. Confirm appeal decision authority and whether users may respond to `Needs Information`.
7. Confirm record retention, deletion permissions, backup/export ownership and draft/offline policy.

