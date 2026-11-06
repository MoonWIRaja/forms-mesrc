# Maintenance Setup Guide

This guide is for the first Maintenance operator and later Maintenance users. The application UI and this guide use English. Do not paste credentials into chat, issues, source code or public GitHub files.

## 1. Create the company Drive location

1. Ask the Google Workspace administrator to create or select the company's Shared Drive for application attachments.
2. Create a root folder named `Forms MESRC` in that Shared Drive.
3. Grant the approved application integration identity the minimum required access to create, read and delete files under this folder.
4. Record the Shared Drive ID and root folder ID in the company's approved password/secrets manager. Never put credentials in the public repository.
5. Ask Workspace IT to enable/authorize Google Drive API access and confirm policy for OAuth/service identities. A service account cannot own files or use personal Drive quota; files must be created in the Shared Drive.
6. In Maintenance Settings, open Google Drive and follow the information-icon guide. Enter required values only through the protected setup mechanism. Select **Test Connection** and confirm the app can create/read/delete a temporary test object.

If Settings only provides a status panel during initial setup, an authorized operator must configure secrets in the Supabase Dashboard's Edge Function secrets. The Maintenance panel should then validate connectivity without reading secret values back.

## 2. Configure email

1. Ask Workspace/IT which company sender address and transactional provider are approved.
2. Verify SPF/DKIM/DMARC and sending limits with the provider administrator.
3. Configure Supabase Auth SMTP for OTP and invitation messages.
4. Configure the application notification provider for ticket/status emails in Edge Function secrets.
5. Use Maintenance Settings' test-send action to verify templates reach a controlled test mailbox.
6. Check spam folder, delivery logs and retry behavior. Never put a provider password in the frontend.

Gmail SMTP is not automatically suitable for transactional volume. Use the provider and authentication method approved by Workspace IT; do not assume App Password is allowed.

## 3. Supabase project setup

1. Create separate development and beta projects where possible.
2. Apply reviewed SQL migrations and verify RLS is enabled on every app table.
3. Configure Auth email OTP, redirect URLs for local development and GitHub Pages, and throttles.
4. Deploy Edge Functions and set their secrets through the Supabase Dashboard or an approved secure workflow.
5. Add only the Supabase project URL and publishable key to the static frontend build configuration.
6. Create the first Maintenance profile through the controlled bootstrap procedure; do not enable public role selection.
7. Use synthetic data until access tests and company privacy approval are complete.

## 4. GitHub Pages deployment

1. Confirm the public repository contains no secrets, real data or private exports.
2. Protect the deployment branch and enable GitHub Pages via GitHub Actions.
3. Set the repository base path or configure the approved custom domain.
4. Add public Supabase URL/publishable key as build variables. Do not add service-role or Drive/email credentials.
5. Deploy a placeholder build; check direct route navigation and refresh, HTTPS, PWA installation and service-worker cache contents.
6. Confirm Supabase Auth redirect URLs match the deployed address.

## 5. Rotate and troubleshoot credentials

- Use **Replace/Rotate** in Maintenance Settings if supported; otherwise update the corresponding server-side secret in Supabase Dashboard.
- Run the connection check after rotation.
- Remove old credentials from the provider after successful validation.
- If a secret was committed or exposed, revoke it immediately and create a replacement; deleting the visible value from Git is not enough.
- For Drive errors, check API access, Shared Drive membership, quota, file size, allowed MIME types and resumable upload state.
- For email errors, check provider logs, quota, sender authentication, Auth redirects and outbox retries.

## 6. Information icon behavior

Each integration section's information icon opens an accessible English help panel with prerequisites, where to find values, exact setup steps, a test action, common error resolution and official Google/Supabase links. It never displays saved secrets. Show only configuration state, last successful validation and sanitized errors.
