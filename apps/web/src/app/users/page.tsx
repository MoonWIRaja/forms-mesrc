"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminPermissionsModal from "@/components/AdminPermissionsModal";
import ChunkLoader from "@/components/ChunkLoader";
import InvitationManager from "@/components/InvitationManager";
import type { AdminPermissionsRow } from "@/lib/form-types";
import { getSupabase, type AppRole, type UserProfile } from "@/lib/supabase";

interface MemberProfile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

function defaultAdminPermissions(profileId: string): AdminPermissionsRow {
  return {
    profile_id: profileId,
    can_manage_company_forms: true,
    can_view_company_reports: true,
    can_manage_complaints: false,
    can_view_complaints: false,
    receive_complaint_emails: false,
    can_manage_voting: false,
    can_view_voting_reports: false,
    can_manage_users: false,
  };
}

export default function UsersDirectoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<MemberProfile[]>([]);
  const [permsMap, setPermsMap] = useState<Record<string, AdminPermissionsRow>>({});
  const [editingPermUser, setEditingPermUser] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"members" | "permissions" | "invites">("members");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      const [{ data: myProf }, { data: allUsers }, permsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("admin_permissions").select("*"),
      ]);

      setProfile((myProf as UserProfile | null) ?? null);
      setUsers((allUsers as MemberProfile[] | null) ?? []);
      if (!permsRes.error && permsRes.data) {
        const map: Record<string, AdminPermissionsRow> = {};
        for (const row of permsRes.data as AdminPermissionsRow[]) {
          map[row.profile_id] = row;
        }
        setPermsMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      if (active) {
        await loadData();
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [loadData]);

  async function handleToggleActive(targetUser: MemberProfile) {
    if (!profile) return;
    if (targetUser.id === profile.id) {
      setActionError("You cannot deactivate your own account.");
      return;
    }

    setBusyId(targetUser.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const supabase = getSupabase();
      const nextActive = !targetUser.is_active;
      const { error } = await supabase.rpc("set_user_active", {
        p_user: targetUser.id,
        p_active: nextActive,
      });

      if (error) throw error;

      setActionSuccess(
        `User ${targetUser.email} has been ${nextActive ? "activated" : "deactivated"}.`,
      );
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update user status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleChangeRole(targetUser: MemberProfile, nextRole: "admin" | "user") {
    if (!profile || profile.role !== "maintenance") return;
    if (targetUser.id === profile.id) return;

    const verb = nextRole === "admin" ? "promote to Admin" : "change back to User";
    if (!confirm(`Are you sure you want to ${verb}: ${targetUser.email}?`)) return;

    setBusyId(targetUser.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc("set_user_role", {
        p_user: targetUser.id,
        p_role: nextRole,
      });
      if (error) throw error;

      setActionSuccess(
        nextRole === "admin"
          ? `${targetUser.email} is now an Admin. Click "Configure Permissions" to choose what they can access.`
          : `${targetUser.email} has been changed to standard User.`,
      );
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update role.";
      if (msg.includes("set_user_role")) {
        setActionError(
          "Please run supabase/migrations/20261120010000_phase7b_user_role_rpc.sql in Supabase SQL Editor first to enable role promotion.",
        );
      } else {
        setActionError(msg);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <ChunkLoader
        title="Users & Invites"
        subtitle="Loading workspace members..."
      />
    );
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">
            Only Admin and Maintenance accounts have permission to view and manage team members.
          </p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const adminUsers = users.filter((u) => u.role === "admin");
  const regularUsers = users.filter((u) => u.role === "user");
  const filteredUsers = users.filter((u) => {
    const matchSearch = u.email.toLowerCase().includes(search.trim().toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="stack" style={{ flex: 1 }}>
      <section
        className="card stack admin-full-card"
        style={{ flex: 1, height: "calc(100dvh - 2.5rem)", margin: 0, overflow: "hidden" }}
      >
        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>
            {activeTab === "members"
              ? `Registered Members (${filteredUsers.length})`
              : activeTab === "permissions"
                ? `Admin Permissions (${adminUsers.length})`
                : "Send & Manage Invites"}
          </h2>

          <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className={`pixel-paper-btn compact ${activeTab === "members" ? "primary" : ""}`}
              onClick={() => setActiveTab("members")}
            >
              Members ({users.length})
            </button>
            {profile.role === "maintenance" && (
              <button
                type="button"
                className={`pixel-paper-btn compact ${activeTab === "permissions" ? "primary" : ""}`}
                onClick={() => setActiveTab("permissions")}
              >
                Admin Permissions ({adminUsers.length})
              </button>
            )}
            <button
              type="button"
              className={`pixel-paper-btn compact ${activeTab === "invites" ? "primary" : ""}`}
              onClick={() => setActiveTab("invites")}
            >
              + Send &amp; Manage Invites
            </button>

            {activeTab === "members" && (
              <>
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minWidth: "180px", padding: "0.35rem 0.65rem", fontSize: "0.84rem" }}
                />
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  style={{ padding: "0.35rem 0.65rem", fontSize: "0.84rem" }}
                >
                  <option value="all">All Roles</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </>
            )}
          </div>
        </div>

        {actionError && (
          <p className="alert alert-error" role="alert">
            {actionError}
          </p>
        )}
        {actionSuccess && (
          <p className="alert alert-ok" role="status">
            {actionSuccess}
          </p>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {activeTab === "members" ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                        No members match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === profile.id;
                      const canManage =
                        profile.role === "maintenance" ||
                        (profile.role === "admin" && u.role === "user");

                      return (
                        <tr key={u.id}>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                              <div className="member-avatar">
                                {u.email.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ fontSize: "0.9rem", color: "var(--ink)" }}>
                                  {u.display_name || u.email}
                                </strong>
                                {u.display_name && (
                                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                    {u.email}
                                  </div>
                                )}
                                {isSelf && (
                                  <span
                                    style={{
                                      fontSize: "0.74rem",
                                      marginLeft: "0.45rem",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    (You)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                u.role === "maintenance"
                                  ? "badge-configured"
                                  : u.role === "admin"
                                    ? "badge-admin"
                                    : "badge-not_configured"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                u.is_active ? "badge-configured" : "badge-connection_failed"
                              }`}
                            >
                              {u.is_active ? "Active" : "Suspended"}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                            {new Date(u.created_at).toLocaleDateString()}
                          </td>
                          <td>
                            <div className="row-actions" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                              {profile.role === "maintenance" && u.role === "admin" && (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact primary"
                                  onClick={() => setEditingPermUser(u)}
                                >
                                  Permissions
                                </button>
                              )}
                              {profile.role === "maintenance" && !isSelf && u.role === "user" && (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact"
                                  disabled={busyId === u.id}
                                  onClick={() => void handleChangeRole(u, "admin")}
                                >
                                  Make Admin
                                </button>
                              )}
                              {profile.role === "maintenance" && !isSelf && u.role === "admin" && (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact"
                                  disabled={busyId === u.id}
                                  onClick={() => void handleChangeRole(u, "user")}
                                >
                                  Set User
                                </button>
                              )}
                              {isSelf ? (
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Current</span>
                              ) : canManage ? (
                                <button
                                  type="button"
                                  className={`pixel-paper-btn compact ${u.is_active ? "" : "primary"}`}
                                  disabled={busyId === u.id}
                                  onClick={() => handleToggleActive(u)}
                                >
                                  {busyId === u.id
                                    ? "Updating..."
                                    : u.is_active
                                      ? "Deactivate"
                                      : "Reactivate"}
                                </button>
                              ) : (
                                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : activeTab === "permissions" ? (
            <div className="stack" style={{ gap: "0.9rem" }}>
              <div className="admin-page-group-card stack" style={{ gap: "0.35rem" }}>
                <strong style={{ fontSize: "0.92rem", color: "var(--accent)" }}>
                  How Admin Access Control Works (2 Layers)
                </strong>
                <p className="notice" style={{ margin: 0, fontSize: "0.84rem" }}>
                  <strong>1. Category Permissions (Below):</strong> Decide which modules each Admin
                  account can edit, view reports for, manage users, or receive confidential Staff
                  Complaint email alerts.
                  <br />
                  <strong>2. Per-Form Lock (Craft &rarr; Settings):</strong> On any individual form
                  (e.g. a confidential Voting or Harassment form), enable{" "}
                  <em>Restrict editing &amp; reports</em> to lock it to the Form Owner, Maintenance,
                  and specific Admins only.
                </p>
              </div>

              {adminUsers.length === 0 ? (
                <div className="card stack" style={{ margin: 0, background: "var(--surface-muted)" }}>
                  <strong>No Admin Accounts Yet</strong>
                  <p className="notice" style={{ margin: 0, fontSize: "0.86rem" }}>
                    Permissions apply to accounts with the <code>admin</code> role (Maintenance
                    always has full access). Invite a new Admin under{" "}
                    <strong>+ Send &amp; Manage Invites</strong>, or promote an existing User below:
                  </p>
                  {regularUsers.length > 0 && (
                    <div className="stack" style={{ gap: "0.45rem", marginTop: "0.35rem" }}>
                      {regularUsers.map((u) => (
                        <div
                          key={u.id}
                          className="row-between admin-page-group-card"
                          style={{ gap: "0.75rem", flexWrap: "wrap" }}
                        >
                          <div>
                            <strong>{u.display_name || u.email}</strong>
                            {u.display_name && (
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                {u.email}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="pixel-paper-btn compact primary"
                            disabled={busyId === u.id}
                            onClick={() => void handleChangeRole(u, "admin")}
                          >
                            {busyId === u.id ? "Promoting..." : "Promote to Admin"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="stack" style={{ gap: "0.7rem" }}>
                  {adminUsers.map((adm) => {
                    const p = permsMap[adm.id] ?? defaultAdminPermissions(adm.id);
                    const hasCustom = Boolean(permsMap[adm.id]);
                    return (
                      <div
                        key={adm.id}
                        className="admin-page-group-card stack"
                        style={{ gap: "0.55rem", borderLeft: "5px solid var(--accent)" }}
                      >
                        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.65rem" }}>
                          <div>
                            <strong style={{ fontSize: "0.96rem" }}>
                              {adm.display_name || adm.email}
                            </strong>
                            <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                              {adm.email} {!hasCustom && "· Default settings (click Configure to restrict)"}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="pixel-paper-btn compact primary"
                            onClick={() => setEditingPermUser(adm)}
                          >
                            Configure Permissions
                          </button>
                        </div>

                        <div className="row-actions" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                          <span
                            className={`pixel-stamp-badge ${
                              p.can_manage_company_forms || p.can_view_company_reports
                                ? "live"
                                : "draft"
                            }`}
                          >
                            Company Forms:{" "}
                            {p.can_manage_company_forms
                              ? "Edit + View"
                              : p.can_view_company_reports
                                ? "View Only"
                                : "Blocked"}
                          </span>
                          <span
                            className={`pixel-stamp-badge ${
                              p.can_manage_complaints || p.can_view_complaints ? "live" : "draft"
                            }`}
                          >
                            Complaints:{" "}
                            {p.can_manage_complaints
                              ? "Edit + View"
                              : p.can_view_complaints
                                ? "View Only"
                                : "Blocked"}
                          </span>
                          <span
                            className={`pixel-stamp-badge ${
                              p.receive_complaint_emails ? "live" : "draft"
                            }`}
                          >
                            Complaint Emails: {p.receive_complaint_emails ? "ON" : "OFF"}
                          </span>
                          <span
                            className={`pixel-stamp-badge ${
                              p.can_manage_voting || p.can_view_voting_reports ? "live" : "draft"
                            }`}
                          >
                            Education:{" "}
                            {p.can_manage_voting
                              ? "Edit + View"
                              : p.can_view_voting_reports
                                ? "View Only"
                                : "Blocked"}
                          </span>
                          <span
                            className={`pixel-stamp-badge ${p.can_manage_users ? "live" : "draft"}`}
                          >
                            Users: {p.can_manage_users ? "Allowed" : "Blocked"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <InvitationManager callerRole={profile.role} />
          )}
        </div>
      </section>

      {editingPermUser && (
        <AdminPermissionsModal
          adminId={editingPermUser.id}
          adminEmail={editingPermUser.email}
          initialPermissions={
            permsMap[editingPermUser.id] ?? defaultAdminPermissions(editingPermUser.id)
          }
          onClose={() => setEditingPermUser(null)}
          onSaved={(next) => {
            setPermsMap((prev) => ({ ...prev, [next.profile_id]: next }));
            setActionSuccess(`Permissions updated for ${editingPermUser.email}.`);
          }}
        />
      )}
    </div>
  );
}
