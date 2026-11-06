"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import InfoPopover from "./InfoPopover";

export interface DriveConfigPublic {
  account_email?: string;
  shared_drive_id?: string;
  root_folder_id?: string;
  root_folder_name?: string;
  client_id?: string;
}

interface GoogleDriveSetupFormProps {
  initialConfig?: DriveConfigPublic;
  initialHasSecret?: boolean;
  initialValidationState?: string;
  lastCheckedAt?: string | null;
  isWizardStep?: boolean;
  onSaved?: () => void;
}

export default function GoogleDriveSetupForm({
  initialConfig,
  initialHasSecret = false,
  initialValidationState = "not_configured",
  lastCheckedAt = null,
  isWizardStep = false,
  onSaved,
}: GoogleDriveSetupFormProps) {
  const [accountEmail, setAccountEmail] = useState(initialConfig?.account_email ?? "");
  const [sharedDriveId, setSharedDriveId] = useState(initialConfig?.shared_drive_id ?? "");
  const [rootFolderId, setRootFolderId] = useState(initialConfig?.root_folder_id ?? "");
  const [rootFolderName, setRootFolderName] = useState(
    initialConfig?.root_folder_name ?? "Forms MESRC",
  );
  const [clientId, setClientId] = useState(initialConfig?.client_id ?? "");
  const [secretJson, setSecretJson] = useState("");
  const [hasSecret, setHasSecret] = useState(initialHasSecret);
  const [validationState, setValidationState] = useState(initialValidationState);
  const [checkedAt, setCheckedAt] = useState<string | null>(lastCheckedAt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcErr } = await supabase.rpc("save_google_drive_settings", {
        p_account_email: accountEmail,
        p_shared_drive_id: sharedDriveId,
        p_root_folder_id: rootFolderId,
        p_root_folder_name: rootFolderName || "Forms MESRC",
        p_client_id: clientId || null,
        p_secret_json: secretJson.trim() ? secretJson.trim() : null,
        p_mark_wizard_complete: true,
      });
      if (rpcErr) throw rpcErr;
      const result = data as { validation_state: string; has_secret: boolean };
      setHasSecret(result.has_secret);
      setValidationState(result.validation_state);
      setCheckedAt(new Date().toISOString());
      setSecretJson("");
      setMessage(
        isWizardStep
          ? "Google Drive settings saved and first-time setup completed."
          : "Google Drive settings saved.",
      );
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Google Drive settings.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearSecret() {
    if (!window.confirm("Clear the stored Google Drive credential? Uploads will stop until replaced.")) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("clear_integration_secret", {
        p_provider: "google_drive",
      });
      if (rpcErr) throw rpcErr;
      setHasSecret(false);
      setValidationState("not_configured");
      setCheckedAt(new Date().toISOString());
      setMessage("Stored Google Drive credential cleared.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear credential.");
    } finally {
      setBusy(false);
    }
  }

  const stateBadge =
    validationState === "configured"
      ? "Configured"
      : validationState === "connection_failed"
        ? "Connection failed"
        : "Not configured";

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="row-between">
        <div>
          <span className={`badge badge-${validationState}`}>{stateBadge}</span>
          {checkedAt && (
            <span className="notice" style={{ marginLeft: "0.75rem", fontSize: "0.875rem" }}>
              Last checked: {new Date(checkedAt).toLocaleString()}
            </span>
          )}
        </div>
        <InfoPopover title="Google Workspace Shared Drive Setup Guide">
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>
              <strong>Prerequisites:</strong> Ask your Google Workspace administrator to enable the{" "}
              <em>Google Drive API</em> in Google Cloud Console and create a dedicated company{" "}
              <strong>Service Account</strong> (or OAuth client).
            </li>
            <li>
              <strong>Shared Drive &amp; Root Folder:</strong> Open Google Drive &rarr;{" "}
              <em>Shared drives</em>, create or open the company Shared Drive, and create a root
              folder named <code>Forms MESRC</code>. Grant the Service Account{" "}
              <em>Content manager</em> access on that Shared Drive.
            </li>
            <li>
              <strong>Where to find IDs:</strong> Open the Shared Drive in your browser; the URL ends
              with <code>/folders/&lt;SHARED_DRIVE_ID&gt;</code>. Open the <code>Forms MESRC</code>{" "}
              folder; its URL ends with <code>/folders/&lt;ROOT_FOLDER_ID&gt;</code>.
            </li>
            <li>
              <strong>Storage structure:</strong> Attachments are stored privately under{" "}
              <code>Forms MESRC/&#123;user_id&#125;/&#123;submission_id&#125;</code> (maximum 1 GiB
              per file). Public sharing links are never created.
            </li>
            <li>
              <strong>Official docs:</strong>{" "}
              <a
                href="https://developers.google.com/drive/api/guides/about-shareddrives"
                target="_blank"
                rel="noreferrer"
              >
                Google Drive API Shared Drives Guide
              </a>
            </li>
          </ol>
        </InfoPopover>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="alert alert-ok" role="status">
          {message}
        </p>
      )}

      <div className="field">
        <label htmlFor="gd-email">
          Company Google / Service Account Email
          <InfoPopover title="Integration Account Email">
            Enter the company-owned Service Account address (for example{" "}
            <code>forms-mesrc-drive@your-project.iam.gserviceaccount.com</code>) or company Google
            Workspace integration account granted access to the Shared Drive.
          </InfoPopover>
        </label>
        <input
          id="gd-email"
          type="email"
          required
          placeholder="forms-drive@company-project.iam.gserviceaccount.com"
          value={accountEmail}
          onChange={(e) => setAccountEmail(e.target.value)}
        />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="gd-shared-id">
            Shared Drive ID
            <InfoPopover title="Where to find Shared Drive ID">
              In Google Drive, click your Shared Drive. Copy the ID after <code>/folders/</code> in
              the browser address bar (typically starts with <code>0A...</code>).
            </InfoPopover>
          </label>
          <input
            id="gd-shared-id"
            type="text"
            required
            placeholder="0A1B2C3D4E5F6G7H8I9J"
            value={sharedDriveId}
            onChange={(e) => setSharedDriveId(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="gd-root-id">
            Root Folder ID (<code>Forms MESRC</code>)
            <InfoPopover title="Where to find Root Folder ID">
              Inside the Shared Drive, open the <code>Forms MESRC</code> folder and copy the folder
              ID after <code>/folders/</code> in the browser URL.
            </InfoPopover>
          </label>
          <input
            id="gd-root-id"
            type="text"
            required
            placeholder="1AbCdEfGhIjKlMnOpQrStUvWxYz"
            value={rootFolderId}
            onChange={(e) => setRootFolderId(e.target.value)}
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="gd-root-name">Root Folder Name</label>
          <input
            id="gd-root-name"
            type="text"
            value={rootFolderName}
            onChange={(e) => setRootFolderName(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="gd-client-id">Client ID / Key ID (optional metadata)</label>
          <input
            id="gd-client-id"
            type="text"
            placeholder="Optional OAuth Client ID or Key ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="gd-secret">
          Service Account JSON Key / OAuth Credential Bundle (Write-Only)
          <InfoPopover title="Safe Credential Storage">
            Secrets are encrypted server-side in a private schema using <code>pgcrypto</code> and
            are never returned to the browser after saving. Leave blank to keep the existing stored
            credential, or paste a new JSON key to rotate it.
          </InfoPopover>
        </label>
        <textarea
          id="gd-secret"
          rows={4}
          placeholder={
            hasSecret
              ? "Credential is already stored securely. Paste a new JSON key here only if you want to rotate/replace it."
              : '{"type":"service_account","project_id":"your-project-id","client_email":"..."}'
          }
          value={secretJson}
          onChange={(e) => setSecretJson(e.target.value)}
        />
      </div>

      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy
            ? "Saving..."
            : isWizardStep
              ? "Save Google Drive Setup & Finish Wizard"
              : "Save Google Drive Settings"}
        </button>
        {hasSecret && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={handleClearSecret}
          >
            Clear Stored Secret
          </button>
        )}
      </div>
    </form>
  );
}