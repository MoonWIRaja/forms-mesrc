"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import InvitationManager from "@/components/InvitationManager";
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

export default function UsersDirectoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
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

      const [{ data: myProf }, { data: allUsers }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      ]);

      setProfile((myProf as UserProfile | null) ?? null);
      setUsers((allUsers as MemberProfile[] | null) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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

  if (loading) {
    return (
      <ChunkLoader
        title="Users & Team Directory"
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
              Return to Dashboard
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.email.toLowerCase().includes(search.trim().toLowerCase());
    const matchRole = filterRole === "all" || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const activeCount = users.filter((u) => u.is_active).length;
  const maintenanceCount = users.filter((u) => u.role === "maintenance").length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const userCount = users.filter((u) => u.role === "user").length;

  return (
    <div className="stack">
      {/* Header Banner */}
      <section className="card row-between" style={{ alignItems: "flex-start" }}>
        <div>
          <span className="badge" style={{ marginBottom: "0.5rem" }}>
            Workspace Directory
          </span>
          <h1>Team &amp; User Management</h1>
          <p className="notice">
            Manage company member roles, view active accounts, and issue secure email invitations.
          </p>
        </div>
        <div className="row-actions">
          <a href="#invite-section" className="btn btn-primary">
            + Invite New Member
          </a>
        </div>
      </section>

      {/* Metrics Row */}
      <div className="grid-4">
        <div className="card stat-card">
          <span className="stat-label">Total Members</span>
          <strong className="stat-value">{users.length}</strong>
          <span className="notice" style={{ fontSize: "0.78rem" }}>
            {activeCount} active
          </span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Maintenance</span>
          <strong className="stat-value">{maintenanceCount}</strong>
          <span className="notice" style={{ fontSize: "0.78rem" }}>Full Authority</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Admins</span>
          <strong className="stat-value">{adminCount}</strong>
          <span className="notice" style={{ fontSize: "0.78rem" }}>Managers</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Users</span>
          <strong className="stat-value">{userCount}</strong>
          <span className="notice" style={{ fontSize: "0.78rem" }}>Requesters</span>
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

      {/* Users Table */}
      <section className="card stack">
        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <h2>Registered Members ({filteredUsers.length})</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: "220px", padding: "0.35rem 0.65rem", fontSize: "0.88rem" }}
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{ padding: "0.35rem 0.65rem", fontSize: "0.88rem" }}
            >
              <option value="all">All Roles</option>
              <option value="maintenance">Maintenance</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="notice" style={{ textAlign: "center", padding: "1.5rem" }}>
                    No members match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === profile.id;
                  const canManage =
                    profile.role === "maintenance" || (profile.role === "admin" && u.role === "user");

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div className="member-avatar">
                            {u.email.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: "0.92rem" }}>{u.email}</strong>
                            {isSelf && (
                              <span style={{ fontSize: "0.74rem", marginLeft: "0.45rem", color: "var(--muted)" }}>
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
                      <td style={{ fontSize: "0.86rem", color: "var(--muted)" }}>
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        {isSelf ? (
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Active Self</span>
                        ) : canManage ? (
                          <button
                            type="button"
                            className={`btn ${u.is_active ? "btn-secondary" : "btn-primary"}`}
                            style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invitations Section */}
      <section id="invite-section" className="card stack">
        <InvitationManager callerRole={profile.role} />
      </section>
    </div>
  );
}
