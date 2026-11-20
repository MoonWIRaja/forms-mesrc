"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface TicketRow {
  id: string;
  form_id: string;
  submission_id: string | null;
  user_id: string;
  kind: "appeal" | "complaint";
  reason: string;
  status: "open" | "taken" | "resolved" | "reopened" | "closed";
  taken_by: string | null;
  taken_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

interface TicketMessage {
  id: number;
  ticket_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface StaffPeer {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
}

type TicketActionModalMode = "resolve" | "transfer" | "help" | null;

export default function TicketDetailClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [formTitle, setFormTitle] = useState<string>("");
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [staffPeers, setStaffPeers] = useState<StaffPeer[]>([]);
  const [staffById, setStaffById] = useState<Record<string, StaffPeer>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  // Custom Popup Modal State (replaces ugly browser prompt())
  const [modalMode, setModalMode] = useState<TicketActionModalMode>(null);
  const [resolutionInput, setResolutionInput] = useState("");
  const [selectedPeerEmail, setSelectedPeerEmail] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const ticketId =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("id") ||
        decodeURIComponent(window.location.pathname.replace(/\/+$/, "").split("/").at(-1) ?? "");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: tRow }, { data: mRows }, { data: peerRows }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
            supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
            supabase
              .from("ticket_messages")
              .select("*")
              .eq("ticket_id", ticketId)
              .order("created_at", { ascending: true }),
            supabase
              .from("profiles")
              .select("id,email,display_name,role")
              .in("role", ["admin", "maintenance"])
              .eq("is_active", true)
              .order("email", { ascending: true }),
          ]);

        if (!active) return;
        const loadedTicket = (tRow as TicketRow | null) ?? null;
        setProfile((prof as UserProfile | null) ?? null);
        setTicket(loadedTicket);
        setMessages((mRows as TicketMessage[] | null) ?? []);

        const peers = (peerRows as StaffPeer[] | null) ?? [];
        setStaffPeers(peers);
        const map: Record<string, StaffPeer> = {};
        for (const p of peers) map[p.id] = p;
        setStaffById(map);

        if (loadedTicket?.form_id) {
          const { data: fRow } = await supabase
            .from("forms")
            .select("title")
            .eq("id", loadedTicket.form_id)
            .maybeSingle();
          if (active && fRow && "title" in fRow) {
            setFormTitle(String((fRow as { title: string }).title));
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load ticket.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ticketId]);

  const isAdminOrMaint = profile ? profile.role === "admin" || profile.role === "maintenance" : false;
  const isTakenByMe = ticket ? ticket.taken_by === (profile?.id ?? "") : false;

  async function refreshTicket() {
    const supabase = getSupabase();
    const { data: tRow } = await supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle();
    if (tRow) setTicket(tRow as TicketRow);
  }

  function openActionModal(mode: TicketActionModalMode) {
    setModalError(null);
    if (mode === "resolve") {
      setResolutionInput(ticket?.resolution ?? "");
    } else {
      const otherPeers = staffPeers.filter((p) => p.id !== profile?.id);
      setSelectedPeerEmail(otherPeers[0]?.email ?? staffPeers[0]?.email ?? "");
    }
    setModalMode(mode);
  }

  async function handleTakeTicket() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("take_ticket", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      await refreshTicket();
      setInfo("Ticket claimed and assigned to you.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Take ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmResolve(e: React.FormEvent) {
    e.preventDefault();
    const cleanNotes = resolutionInput.trim();
    if (!cleanNotes) {
      setModalError("Please enter resolution notes before resolving.");
      return;
    }
    setBusy(true);
    setModalError(null);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("resolve_ticket", {
        p_ticket_id: ticketId,
        p_resolution: cleanNotes,
      });
      if (rpcErr) throw rpcErr;
      await refreshTicket();
      setModalMode(null);
      setInfo("Ticket marked as Resolved.");
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Resolve ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopenTicket() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("reopen_ticket", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      await refreshTicket();
      setInfo("Ticket reopened.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reopen ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmPeerAction(e: React.FormEvent) {
    e.preventDefault();
    const targetEmail = selectedPeerEmail.trim().toLowerCase();
    if (!targetEmail) {
      setModalError("Please select or enter an Admin/Maintenance email.");
      return;
    }
    setBusy(true);
    setModalError(null);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { data: matched } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("email", targetEmail)
        .in("role", ["admin", "maintenance"]);
      if (!matched || matched.length === 0) {
        setModalError("Account not found or is not an Admin / Maintenance user.");
        return;
      }
      const targetUser = matched[0];

      if (modalMode === "help") {
        const { error: rpcErr } = await supabase.rpc("request_help", {
          p_ticket_id: ticketId,
          p_helper_id: targetUser.id,
        });
        if (rpcErr) throw rpcErr;
        await supabase.functions.invoke("send-outbox-emails").catch(() => {});
        setModalMode(null);
        setInfo(`Help request sent to ${targetUser.email}.`);
      } else if (modalMode === "transfer") {
        const { error: rpcErr } = await supabase.rpc("transfer_ticket", {
          p_ticket_id: ticketId,
          p_new_owner_id: targetUser.id,
        });
        if (rpcErr) throw rpcErr;
        await refreshTicket();
        setModalMode(null);
        setInfo(`Ticket transferred to ${targetUser.email}.`);
      }
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAcceptHelp() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("accept_help", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      setInfo("Help request accepted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept help failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeclineHelp() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("decline_help", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      setInfo("Help request declined.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decline help failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: insErr } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: profile?.id,
        message: newMessage.trim(),
      });
      if (insErr) throw insErr;
      setNewMessage("");
      const { data: mRows } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      setMessages((mRows as TicketMessage[] | null) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send message failed.");
    } finally {
      setBusy(false);
    }
  }

  const canTake = isAdminOrMaint && ticket?.status === "open";
  const canResolve = (isAdminOrMaint || isTakenByMe) && ticket?.status === "taken";
  const canReopen = (isAdminOrMaint || ticket?.user_id === profile?.id) && ticket?.status === "resolved";
  const canTransfer = isAdminOrMaint && ticket?.status === "taken";

  if (loading) {
    return <ChunkLoader title="Ticket" subtitle="Loading ticket details..." />;
  }

  if (!profile) {
    return (
      <section className="card stack">
        <h1>Sign In Required</h1>
        <p className="notice">Please sign in to view this ticket.</p>
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in with Email OTP
          </Link>
        </div>
      </section>
    );
  }

  if (!ticket) {
    return (
      <section className="card stack">
        <h1>Ticket Not Found</h1>
        <p className="notice">
          {error ?? "This ticket does not exist or you do not have access to it."}
        </p>
        <div className="row-actions">
          <Link href="/tickets/" className="btn btn-primary">
            Back to Staff Complaints
          </Link>
        </div>
      </section>
    );
  }

  const assignedStaff = ticket.taken_by ? staffById[ticket.taken_by] : undefined;
  const assignedLabel = ticket.taken_by
    ? assignedStaff
      ? `${assignedStaff.display_name || assignedStaff.email} (${assignedStaff.role.toUpperCase()})`
      : `Assigned Admin (${ticket.taken_by.slice(0, 8)})`
    : "Pending Admin Review";

  const popupModal =
    modalMode && typeof document !== "undefined"
      ? createPortal(
          <div
            className="ios-sheet-backdrop device-desktop"
            role="dialog"
            aria-modal="true"
            aria-label={
              modalMode === "resolve"
                ? "Resolve Ticket"
                : modalMode === "transfer"
                  ? "Transfer Ticket"
                  : "Request Help"
            }
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) setModalMode(null);
            }}
          >
            <div className="ios-sheet-card device-desktop" style={{ maxWidth: "480px" }}>
              <div className="ios-sheet-header">
                <div>
                  <h2 className="ios-sheet-title">
                    {modalMode === "resolve"
                      ? "Resolve Ticket"
                      : modalMode === "transfer"
                        ? "Transfer Ticket"
                        : "Request Help"}
                  </h2>
                  <span className="ios-sheet-subtitle">
                    Ticket #{ticket.id.slice(0, 8)} &middot;{" "}
                    {formTitle || "Confidential Staff Complaint"}
                  </span>
                </div>
                <button
                  type="button"
                  className="ios-sheet-close-btn"
                  disabled={busy}
                  onClick={() => setModalMode(null)}
                  aria-label="Close popup"
                >
                  &times;
                </button>
              </div>

              {modalError && (
                <p className="alert alert-error" role="alert" style={{ margin: "0 0 0.75rem" }}>
                  {modalError}
                </p>
              )}

              {modalMode === "resolve" ? (
                <form onSubmit={handleConfirmResolve} className="ios-sheet-form">
                  <div className="ios-sheet-field">
                    <span className="ios-sheet-floating-label">
                      Resolution Notes &amp; Action Taken
                    </span>
                    <textarea
                      rows={4}
                      required
                      autoFocus
                      placeholder="Describe how this complaint was resolved or the outcome..."
                      value={resolutionInput}
                      onChange={(e) => setResolutionInput(e.target.value)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        outline: "none",
                        font: "inherit",
                        fontSize: "0.92rem",
                        color: "var(--ink)",
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div className="ios-sheet-actions">
                    <button
                      type="button"
                      className="ios-sheet-btn cancel"
                      disabled={busy}
                      onClick={() => setModalMode(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="ios-sheet-btn primary" disabled={busy}>
                      {busy ? "Resolving..." : "Confirm Resolution"}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmPeerAction} className="ios-sheet-form">
                  {staffPeers.length > 0 && (
                    <div className="ios-sheet-field">
                      <span className="ios-sheet-floating-label">
                        {modalMode === "transfer"
                          ? "Select New Owner (Admin / Maintenance)"
                          : "Select Helper (Admin / Maintenance)"}
                      </span>
                      <select
                        value={selectedPeerEmail}
                        onChange={(e) => setSelectedPeerEmail(e.target.value)}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          outline: "none",
                          font: "inherit",
                          fontSize: "0.92rem",
                          color: "var(--ink)",
                        }}
                      >
                        {staffPeers.map((peer) => (
                          <option key={peer.id} value={peer.email}>
                            {peer.display_name ? `${peer.display_name} (${peer.email})` : peer.email}{" "}
                            — {peer.role.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="ios-sheet-field">
                    <span className="ios-sheet-floating-label">Or Enter Email Address</span>
                    <input
                      type="email"
                      required
                      placeholder="admin@company.com"
                      value={selectedPeerEmail}
                      onChange={(e) => setSelectedPeerEmail(e.target.value)}
                    />
                  </div>

                  <div className="ios-sheet-actions">
                    <button
                      type="button"
                      className="ios-sheet-btn cancel"
                      disabled={busy}
                      onClick={() => setModalMode(null)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="ios-sheet-btn primary" disabled={busy}>
                      {busy
                        ? "Processing..."
                        : modalMode === "transfer"
                          ? "Transfer Ticket"
                          : "Send Help Request"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="stack" style={{ flex: 1 }}>
      <section
        className="card stack admin-full-card"
        style={{ flex: 1, maxHeight: "calc(100dvh - 2.5rem)", margin: 0, overflowY: "auto" }}
      >
        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <h1 style={{ marginBottom: "0.2rem" }}>Ticket #{ticket.id.slice(0, 8)}</h1>
            <p className="notice" style={{ margin: 0 }}>
              {ticket.kind === "appeal" ? "Formal Appeal" : "Confidential Staff Complaint"}
            </p>
          </div>
          <span
            className={`pixel-stamp-badge ${
              ticket.status === "open" || ticket.status === "reopened" ? "draft" : "live"
            }`}
          >
            {ticket.status.toUpperCase()}
          </span>
        </div>

        {error && (
          <p className="alert alert-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        {info && (
          <p className="alert alert-ok" role="status" style={{ margin: 0 }}>
            {info}
          </p>
        )}

        <section className="card stack" style={{ margin: 0, background: "var(--surface-muted)" }}>
          <h2 style={{ margin: 0 }}>Details</h2>
          <div className="field">
            <label>Form</label>
            <p className="notice" style={{ margin: 0, color: "var(--ink)", fontWeight: 700 }}>
              {formTitle || ticket.form_id}
            </p>
          </div>
          <div className="field">
            <label>Summary / Details</label>
            <p className="notice" style={{ margin: 0, color: "var(--ink)", whiteSpace: "pre-line" }}>
              {ticket.reason}
            </p>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Status</label>
              <p className="notice" style={{ margin: 0, textTransform: "uppercase", fontWeight: 700 }}>
                {ticket.status}
              </p>
            </div>
            <div className="field">
              <label>Handled By</label>
              <p className="notice" style={{ margin: 0 }}>
                {assignedLabel}
              </p>
            </div>
          </div>
          <div className="field">
            <label>Submitted</label>
            <p className="notice" style={{ margin: 0 }}>
              {new Date(ticket.created_at).toLocaleString()}
            </p>
          </div>
          {ticket.resolved_at && (
            <div className="field">
              <label>Resolved At</label>
              <p className="notice" style={{ margin: 0 }}>
                {new Date(ticket.resolved_at).toLocaleString()}
              </p>
            </div>
          )}
          {ticket.resolution && (
            <div className="field">
              <label>Resolution</label>
              <p className="notice" style={{ margin: 0, color: "var(--ok-text)", fontWeight: 600 }}>
                {ticket.resolution}
              </p>
            </div>
          )}
        </section>

        <div className="row-actions" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          {canTake && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={handleTakeTicket}
            >
              Take Ticket
            </button>
          )}
          {canResolve && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => openActionModal("resolve")}
            >
              Resolve Ticket
            </button>
          )}
          {canReopen && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={handleReopenTicket}
            >
              Reopen Ticket
            </button>
          )}
          {canTransfer && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => openActionModal("transfer")}
            >
              Transfer
            </button>
          )}
          {isTakenByMe && ticket.status === "taken" && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => openActionModal("help")}
            >
              Request Help
            </button>
          )}
          {isAdminOrMaint && ticket.status === "taken" && !isTakenByMe && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={handleAcceptHelp}
              >
                Accept Help
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={handleDeclineHelp}
              >
                Decline Help
              </button>
            </>
          )}
          <Link href="/tickets/" className="btn btn-secondary">
            &larr; Back to Staff Complaints
          </Link>
        </div>

        <section className="card stack" style={{ margin: 0 }}>
          <h2 style={{ margin: 0 }}>Messages &amp; Updates</h2>
          <div className="table-wrap" style={{ maxHeight: "260px", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="notice">
                      No messages yet.
                    </td>
                  </tr>
                ) : (
                  messages.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>
                          {m.sender_id === profile.id
                            ? "You"
                            : m.sender_id === ticket.user_id
                              ? "Complainant"
                              : staffById[m.sender_id]?.display_name ||
                                staffById[m.sender_id]?.email ||
                                "Admin"}
                        </strong>
                      </td>
                      <td>{m.message}</td>
                      <td style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="field">
            <label>New Message</label>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              placeholder="Write a follow-up update or question..."
            />
          </div>
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !newMessage.trim()}
              onClick={handleSendMessage}
            >
              Send Message
            </button>
          </div>
        </section>
      </section>

      {popupModal}
    </div>
  );
}
