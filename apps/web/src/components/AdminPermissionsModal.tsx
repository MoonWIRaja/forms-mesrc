"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { AdminPermissionsRow } from "@/lib/form-types";
import { getSupabase } from "@/lib/supabase";

interface AdminPermissionsModalProps {
  adminId: string;
  adminEmail: string;
  initialPermissions: AdminPermissionsRow;
  onClose: () => void;
  onSaved: (next: AdminPermissionsRow) => void;
}

export default function AdminPermissionsModal({
  adminId,
  adminEmail,
  initialPermissions,
  onClose,
  onSaved,
}: AdminPermissionsModalProps) {
  const [perms, setPerms] = useState<AdminPermissionsRow>(initialPermissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("set_admin_permissions", {
        p_profile_id: adminId,
        p_can_manage_company_forms: perms.can_manage_company_forms,
        p_can_view_company_reports: perms.can_view_company_reports,
        p_can_manage_complaints: perms.can_manage_complaints,
        p_can_view_complaints: perms.can_view_complaints,
        p_receive_complaint_emails: perms.receive_complaint_emails,
        p_can_manage_voting: perms.can_manage_voting,
        p_can_view_voting_reports: perms.can_view_voting_reports,
        p_can_manage_users: perms.can_manage_users,
      });
      if (rpcErr) throw rpcErr;
      onSaved(perms);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save permissions.";
      if (msg.includes("set_admin_permissions")) {
        setError(
          "Please run the Phase 7 SQL migration (20261120000000_phase7_permissions_and_notifications.sql) in Supabase SQL Editor first.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  const modalNode = (
    <div
      className="ios-sheet-backdrop device-desktop"
      role="dialog"
      aria-modal="true"
      aria-label="Admin Permissions"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ios-sheet-card device-desktop" style={{ maxWidth: "540px" }}>
        <div className="ios-sheet-header">
          <div>
            <h2 className="ios-sheet-title">Admin Permissions</h2>
            <span className="ios-sheet-subtitle">{adminEmail}</span>
          </div>
          <button
            type="button"
            className="ios-sheet-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <form onSubmit={handleSave} className="stack" style={{ gap: "0.75rem" }}>
          <div className="perm-group-card">
            <strong className="perm-group-title">Company Forms</strong>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_manage_company_forms}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_manage_company_forms: e.target.checked }))
                }
              />
              <span>Create, edit &amp; publish Company Forms</span>
            </label>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_view_company_reports}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_view_company_reports: e.target.checked }))
                }
              />
              <span>View Company Form submissions &amp; reports</span>
            </label>
          </div>

          <div className="perm-group-card">
            <strong className="perm-group-title">Staff Complaints &amp; Harassment (Confidential)</strong>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_manage_complaints}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_manage_complaints: e.target.checked }))
                }
              />
              <span>Create &amp; edit Staff Complaint forms</span>
            </label>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_view_complaints}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_view_complaints: e.target.checked }))
                }
              />
              <span>View confidential complaint reports &amp; handle tickets</span>
            </label>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.receive_complaint_emails}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, receive_complaint_emails: e.target.checked }))
                }
              />
              <span>Receive instant email alerts when staff submit complaints</span>
            </label>
          </div>

          <div className="perm-group-card">
            <strong className="perm-group-title">Education (Evaluations &amp; Competition Rankings)</strong>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_manage_voting}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_manage_voting: e.target.checked }))
                }
              />
              <span>Create &amp; edit Education / Competition Scoring forms</span>
            </label>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_view_voting_reports}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_view_voting_reports: e.target.checked }))
                }
              />
              <span>View education scoreboards, judge marks &amp; rankings</span>
            </label>
          </div>

          <div className="perm-group-card">
            <strong className="perm-group-title">Team &amp; Invites</strong>
            <label className="perm-check-row">
              <input
                type="checkbox"
                checked={perms.can_manage_users}
                onChange={(e) =>
                  setPerms((p) => ({ ...p, can_manage_users: e.target.checked }))
                }
              />
              <span>Invite &amp; manage staff member accounts</span>
            </label>
          </div>

          <div className="ios-sheet-actions">
            <button
              type="button"
              className="ios-sheet-btn cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="ios-sheet-btn primary" disabled={saving}>
              {saving ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalNode, document.body);
}
