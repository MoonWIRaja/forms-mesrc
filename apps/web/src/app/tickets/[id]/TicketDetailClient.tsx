"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface TicketRow {
  id: string; form_id: string; submission_id: string | null; user_id: string;
  kind: "appeal" | "complaint"; reason: string;
  status: "open" | "taken" | "resolved" | "reopened" | "closed";
  taken_by: string | null; taken_at: string | null; resolved_at: string | null;
  resolution: string | null; created_at: string; updated_at: string;
}
interface TicketMessage { id: number; ticket_id: string; sender_id: string; message: string; created_at: string; }

export default function TicketDetailClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const ticketId = typeof window === "undefined"
    ? ""
    : decodeURIComponent(window.location.pathname.replace(/\/+$/, "").split("/").at(-1) ?? "");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: tRow }, { data: mRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("tickets").select("*").eq("id", ticketId).maybeSingle(),
          supabase
            .from("ticket_messages")
            .select("*")
            .eq("ticket_id", ticketId)
            .order("created_at", { ascending: true }),
        ]);

        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setTicket((tRow as TicketRow | null) ?? null);
        setMessages((mRows as TicketMessage[] | null) ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load ticket.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [ticketId]);

  const isAdminOrMaint = profile ? profile.role === "admin" || profile.role === "maintenance" : false;
  const isTakenByMe = ticket ? ticket.taken_by === (profile?.id ?? "") : false;

  async function handleTakeTicket() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("take_ticket", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      const supabase2 = getSupabase();
      const { data: tRow } = await supabase2.from("tickets").select("*").eq("id", ticketId).maybeSingle();
      if (tRow) setTicket(tRow as TicketRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Take ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResolveTicket() {
    const resolution = prompt("Enter resolution notes:");
    if (!resolution) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("resolve_ticket", { p_ticket_id: ticketId, p_resolution: resolution });
      if (rpcErr) throw rpcErr;
      const supabase2 = getSupabase();
      const { data: tRow } = await supabase2.from("tickets").select("*").eq("id", ticketId).maybeSingle();
      if (tRow) setTicket(tRow as TicketRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReopenTicket() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("reopen_ticket", { p_ticket_id: ticketId });
      if (rpcErr) throw rpcErr;
      const supabase2 = getSupabase();
      const { data: tRow } = await supabase2.from("tickets").select("*").eq("id", ticketId).maybeSingle();
      if (tRow) setTicket(tRow as TicketRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reopen ticket failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRequestHelp() {
    const helperEmail = prompt("Enter helper Admin/Maintenance email:");
    if (!helperEmail) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: helpers } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("email", helperEmail.toLowerCase())
        .in("role", ["admin", "maintenance"]);
      if (!helpers || helpers.length === 0) {
        setError("Helper not found or not an Admin/Maintenance.");
        return;
      }
      const helper = helpers[0];
      const { error: rpcErr } = await supabase.rpc("request_help", { p_ticket_id: ticketId, p_helper_id: helper.id });
      if (rpcErr) throw rpcErr;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request help failed.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decline help failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferTicket() {
    const newOwnerEmail = prompt("Enter new owner Admin/Maintenance email:");
    if (!newOwnerEmail) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data: owners } = await supabase
        .from("profiles")
        .select("id, email, role")
        .eq("email", newOwnerEmail.toLowerCase())
        .in("role", ["admin", "maintenance"]);
      if (!owners || owners.length === 0) {
        setError("New owner not found or not an Admin/Maintenance.");
        return;
      }
      const newOwner = owners[0];
      const { error: rpcErr } = await supabase.rpc("transfer_ticket", { p_ticket_id: ticketId, p_new_owner_id: newOwner.id });
      if (rpcErr) throw rpcErr;
      const supabase2 = getSupabase();
      const { data: tRow } = await supabase2.from("tickets").select("*").eq("id", ticketId).maybeSingle();
      if (tRow) setTicket(tRow as TicketRow);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer ticket failed.");
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
    return (
      <ChunkLoader
        title="Ticket"
        subtitle="Loading ticket details..."
      />
    );
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
        <p className="notice">{error ?? "This ticket does not exist or you do not have access to it."}</p>
        <div className="row-actions">
          <Link href="/tickets/" className="btn btn-primary">Back to Tickets</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card stack">
      <div className="row-between">
        <div>
          <h1>Ticket #{ticket.id.slice(0, 8)}</h1>
          <p className="notice">{ticket.kind === "appeal" ? "Formal Appeal" : "Operational Complaint"}</p>
        </div>
        <span className={`badge ${ticket.status === "open" ? "badge-not_configured" : "badge-configured"}`}>
          {ticket.status}
        </span>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <section className="card stack" style={{ marginTop: "0.5rem" }}>
        <h2>Details</h2>
        <div className="field">
          <label>Form ID</label>
          <p className="notice">{ticket.form_id}</p>
        </div>
        {ticket.submission_id && (
          <div className="field">
            <label>Submission ID</label>
            <p className="notice">{ticket.submission_id}</p>
          </div>
        )}
        <div className="field">
          <label>Reason</label>
          <p className="notice">{ticket.reason}</p>
        </div>
        <div className="field">
          <label>Status</label>
          <p className="notice">{ticket.status}</p>
        </div>
        <div className="field">
          <label>Taken By</label>
          <p className="notice">{ticket.taken_by ? ticket.taken_by.slice(0, 8) + "..." : "Ã¢â‚¬â€"}</p>
        </div>
        <div className="field">
          <label>Created</label>
          <p className="notice">{new Date(ticket.created_at).toLocaleString()}</p>
        </div>
        {ticket.resolved_at && (
          <div className="field">
            <label>Resolved At</label>
            <p className="notice">{new Date(ticket.resolved_at).toLocaleString()}</p>
          </div>
        )}
        {ticket.resolution && (
          <div className="field">
            <label>Resolution</label>
            <p className="notice">{ticket.resolution}</p>
          </div>
        )}
      </section>

      <div className="row-actions" style={{ marginTop: "0.5rem", gap: "0.5rem" }}>
        {canTake && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={handleTakeTicket}>
            Take Ticket
          </button>
        )}
        {canResolve && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleResolveTicket}>
            Resolve
          </button>
        )}
        {canReopen && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleReopenTicket}>
            Reopen
          </button>
        )}
        {canTransfer && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleTransferTicket}>
            Transfer
          </button>
        )}
        {isTakenByMe && ticket.status === "taken" && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleRequestHelp}>
            Request Help
          </button>
        )}
        {isAdminOrMaint && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleAcceptHelp}>
            Accept Help
          </button>
        )}
        {isAdminOrMaint && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={handleDeclineHelp}>
            Decline Help
          </button>
        )}
        <Link href="/tickets/" className="btn btn-secondary">Back to Tickets</Link>
      </div>

      <section className="card stack" style={{ marginTop: "1rem" }}>
        <h2>Messages</h2>
        <div className="table-wrap" style={{ maxHeight: "300px", overflowY: "auto" }}>
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
                  <td colSpan={3} className="notice">No messages yet.</td>
                </tr>
              ) : (
                messages.map((m) => (
                  <tr key={m.id}>
                    <td>{m.sender_id.slice(0, 8)}...</td>
                    <td>{m.message}</td>
                    <td>{new Date(m.created_at).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="field" style={{ marginTop: "0.5rem" }}>
          <label>New Message</label>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={3}
            className="input"
            placeholder="Type your message..."
          />
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !newMessage.trim()} onClick={handleSendMessage}>
          Send
        </button>
      </section>
    </section>
  );
}



