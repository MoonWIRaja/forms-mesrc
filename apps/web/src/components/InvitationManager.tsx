"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { APP_NAME, BASE_PATH } from "@/lib/config";
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

interface LastInviteFeedback {
  email: string;
  role: AppRole;
  link: string;
  emailSent: boolean;
  note: string;
}

export default function InvitationManager({ callerRole }: { callerRole: AppRole }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [expiresDays, setExpiresDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<LastInviteFeedback | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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

  async function issueAndDispatchInvite(targetEmail: string, targetRole: AppRole, days: number) {
    const supabase = getSupabase();
    const cleanEmail = targetEmail.trim().toLowerCase();
    const effectiveRole: AppRole = callerRole === "admin" ? "user" : targetRole;

    const { data, error: rpcErr } = await supabase.rpc("create_invitation", {
      p_email: cleanEmail,
      p_role: effectiveRole,
      p_expires_days: days,
    });
    if (rpcErr) throw rpcErr;

    const res = data as {
      id: string;
      invite_token: string;
      email: string;
      role: AppRole;
      expires_at: string;
    };
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteLink = `${origin}${BASE_PATH}/invite/accept/?token=${encodeURIComponent(res.invite_token)}`;
    const expiryDate = new Date(res.expires_at).toLocaleDateString();

    const roleLabel =
      effectiveRole === "maintenance"
        ? "Maintenance Administrator"
        : effectiveRole === "admin"
          ? "Administrator"
          : "Staff Member";

    const subject = `You are invited to ${APP_NAME} (${roleLabel})`;
    const body = [
      `Hello,`,
      ``,
      `You have been invited to join the ${APP_NAME} official workspace as a ${roleLabel}.`,
      ``,
      `Click the Accept Invitation button below (or open this one-time link) to verify your email with a 4-digit OTP code and activate your account:`,
      `${inviteLink}`,
      ``,
      `This invitation expires on ${expiryDate}.`,
    ].join("\n");

    // 1. Queue invitation email into public.email_outbox
    let outboxQueued = false;
    try {
      const { error: outboxErr } = await supabase.from("email_outbox").insert({
        to_email: res.email,
        subject,
        body,
        idempotency_key: `invite:${res.id}`,
        status: "pending",
      });
      if (!outboxErr) outboxQueued = true;
    } catch {
      outboxQueued = false;
    }

    // 2. Immediately trigger the send-outbox-emails Edge Function to deliver the email right away
    let emailSent = false;
    let note = "";

    if (outboxQueued) {
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke(
          "send-outbox-emails",
          { body: { trigger: "invite", invite_id: res.id } },
        );
        const payload = fnData as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
        if (!fnErr && payload?.ok && (payload.sent ?? 0) > 0) {
          emailSent = true;
          note = `Invitation email was automatically sent to ${res.email}.`;
        } else if (payload?.error) {
          note = `Invitation queued, but auto-email returned: ${payload.error}`;
        } else if (fnErr) {
          note =
            "Invitation saved & queued. Deploy the 'send-outbox-emails' Edge Function with your Gmail SMTP secrets in Supabase to send automatically.";
        } else {
          note =
            "Invitation saved & queued, but no email was delivered yet. Check your Supabase Edge Function secrets (SMTP_USER & SMTP_PASS).";
        }
      } catch {
        note =
          "Invitation saved & queued. Deploy the 'send-outbox-emails' Edge Function in Supabase to deliver emails automatically.";
      }
    } else {
      note = "Invitation created, but email outbox queue could not be written.";
    }

    setFeedback({
      email: res.email,
      role: effectiveRole,
      link: inviteLink,
      emailSent,
      note,
    });
    setCopiedLink(false);
    await loadInvites();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await issueAndDispatchInvite(email, role, expiresDays);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend(inv: InviteRow) {
    setResendingId(inv.id);
    setError(null);
    setFeedback(null);
    try {
      await issueAndDispatchInvite(inv.email, inv.role, expiresDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setResendingId(null);
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

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div className="stack">
      <h2>Invite Accounts</h2>
      <p className="notice">
        {callerRole === "maintenance"
          ? "As Maintenance, you can invite Maintenance peers, Admins, and Users. Invitation emails are sent automatically."
          : "As Admin, you can invite Users. Invitation emails are sent automatically."}
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {feedback && (
        <div
          className={`alert ${feedback.emailSent ? "alert-ok" : "banner-info"} stack`}
          style={{ gap: "0.55rem" }}
          role="status"
        >
          <div className="row-between" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <strong>
              {feedback.emailSent
                ? `Invitation Email Sent to ${feedback.email}`
                : `Invitation Created for ${feedback.email} (Pending Auto-Email Setup)`}
            </strong>
            <div className="row-actions" style={{ gap: "0.4rem" }}>
              <button
                type="button"
                className="pixel-paper-btn compact"
                onClick={() => void copyLink(feedback.link)}
              >
                {copiedLink ? "Copied Link!" : "Copy Backup Link"}
              </button>
              {!feedback.emailSent && (
                <a
                  href={`mailto:${encodeURIComponent(feedback.email)}?subject=${encodeURIComponent(
                    `Invitation to ${APP_NAME}`,
                  )}&body=${encodeURIComponent(
                    `Hello,\n\nYou have been invited to join ${APP_NAME}.\n\nOpen this one-time link to activate your account:\n${feedback.link}\n`,
                  )}`}
                  className="pixel-paper-btn compact primary"
                >
                  Open Mail App
                </a>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "0.84rem" }}>{feedback.note}</p>

          {!feedback.emailSent && callerRole === "maintenance" && (
            <div style={{ fontSize: "0.82rem" }}>
              Need automatic sending active?{" "}
              <Link href="/maintenance/settings/" style={{ textDecoration: "underline" }}>
                Open Settings &amp; Storage &rarr; Email &amp; OTP Guide
              </Link>
            </div>
          )}
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
            {busy ? "Sending Invitation..." : "Send Invitation"}
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
                const isResending = resendingId === inv.id;
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
                        <div className="row-actions" style={{ gap: "0.75rem" }}>
                          <button
                            type="button"
                            className="btn-link"
                            disabled={busy || isResending}
                            onClick={() => void handleResend(inv)}
                          >
                            {isResending ? "Sending..." : "Resend Email"}
                          </button>
                          <button
                            type="button"
                            className="btn-link"
                            style={{ color: "var(--err-text)" }}
                            disabled={busy || isResending}
                            onClick={() => void handleRevoke(inv.id)}
                          >
                            Revoke
                          </button>
                        </div>
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
