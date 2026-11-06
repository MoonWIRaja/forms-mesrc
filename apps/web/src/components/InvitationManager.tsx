"use client";

import { useCallback, useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/config";
import { getSupabase, type AppRole } from "@/lib/supabase";

interface InviteRow {
  id: string;
  email: string;
  role: AppRole;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export default function InvitationManager({ callerRole }: { callerRole: AppRole }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [expiresDays, setExpiresDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("invites")
      .select("id,email,role,expires_at,accepted_at,revoked_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setInvites((data as InviteRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("invites")
        .select("id,email,role,expires_at,accepted_at,revoked_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (active) setInvites((data as InviteRow[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastLink(null);
    try {
      const supabase = getSupabase();
      const targetRole: AppRole = callerRole === "admin" ? "user" : role;
      const { data, error: rpcErr } = await supabase.rpc("create_invitation", {
        p_email: email.trim().toLowerCase(),
        p_role: targetRole,
        p_expires_days: expiresDays,
      });
      if (rpcErr) throw rpcErr;
      const res = data as { invite_token: string; email: string };
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setLastLink(
        `${origin}${BASE_PATH}/invite/accept/?token=${encodeURIComponent(res.invite_token)}`,
      );
      setEmail("");
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase
        .from("invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (upErr) throw upErr;
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h2>Invite Accounts</h2>
      <p className="notice">
        {callerRole === "maintenance"
          ? "As Maintenance, you can invite equivalent Maintenance peers, Admins, and Users."
          : "As Admin, you can invite Users."}
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {lastLink && (
        <div className="alert alert-ok stack">
          <strong>Invitation created. Share this one-time link with the invitee:</strong>
          <code>{lastLink}</code>
        </div>
      )}

      <form onSubmit={handleCreate} className="grid-2">
        <div className="field">
          <label htmlFor="inv-new-email">Invitee Email Address</label>
          <input
            id="inv-new-email"
            type="email"
            required
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="inv-new-role">Role</label>
          <select
            id="inv-new-role"
            value={callerRole === "admin" ? "user" : role}
            disabled={callerRole === "admin"}
            onChange={(e) => setRole(e.target.value as AppRole)}
          >
            <option value="user">User (Form respondent / requester)</option>
            {callerRole === "maintenance" && (
              <>
                <option value="admin">Admin (Forms, appeals &amp; tickets)</option>
                <option value="maintenance">Maintenance (Full peer authority)</option>
              </>
            )}
          </select>
        </div>

        <div className="field">
          <label htmlFor="inv-exp">Expires In (days)</label>
          <input
            id="inv-exp"
            type="number"
            min={1}
            max={30}
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value) || 7)}
          />
        </div>

        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creating..." : "Create Invitation"}
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={5} className="notice">
                  No invitations found.
                </td>
              </tr>
            ) : (
              invites.map((inv) => {
                const status = inv.accepted_at
                  ? "Accepted"
                  : inv.revoked_at
                    ? "Revoked"
                    : new Date(inv.expires_at) < new Date()
                      ? "Expired"
                      : "Pending";
                return (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>
                      <code>{inv.role}</code>
                    </td>
                    <td>{status}</td>
                    <td>{new Date(inv.expires_at).toLocaleDateString()}</td>
                    <td>
                      {status === "Pending" && (
                        <button
                          type="button"
                          className="btn-link"
                          disabled={busy}
                          onClick={() => handleRevoke(inv.id)}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}