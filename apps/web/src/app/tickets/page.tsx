"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface TicketRow {
  id: string;
  form_id: string;
  user_id: string;
  kind: "appeal" | "complaint";
  reason: string;
  status: "open" | "taken" | "resolved" | "reopened" | "closed";
  taken_by: string | null;
  taken_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function TicketsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: tRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase
            .from("tickets")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);

        const isAdminOrMaint = prof && (prof.role === "admin" || prof.role === "maintenance");
        const filtered = isAdminOrMaint
          ? (tRows as TicketRow[] | null) ?? []
          : ((tRows as TicketRow[] | null) ?? []).filter((t) => t.user_id === uid);

        setTickets(filtered);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load tickets.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <section className="card">
        <h1>Tickets</h1>
        <p className="notice">Loading tickets...</p>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="card stack">
        <h1>Sign In Required</h1>
        <p className="notice">Please sign in to view tickets.</p>
        <div className="row-actions">
          <Link href="/sign-in/" className="btn btn-primary">
            Sign in with Email OTP
          </Link>
        </div>
      </section>
    );
  }

  const isAdminOrMaint = profile.role === "admin" || profile.role === "maintenance";

  return (
    <section className="card stack">
      <div className="row-between">
        <div>
          <h1>Tickets</h1>
          <p className="notice">
            {isAdminOrMaint
              ? "All tickets. Use Take Ticket to claim an open ticket."
              : "Your tickets. Create a new ticket from a form submission."}
          </p>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {tickets.length === 0 ? (
        <p className="notice">
          {isAdminOrMaint ? "No tickets found." : "You have no tickets yet."}
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Taken By</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.id.slice(0, 8)}</td>
                  <td>
                    <span className={`badge ${t.kind === "appeal" ? "badge-configured" : "badge-not_configured"}`}>
                      {t.kind}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${t.status === "open" ? "badge-not_configured" : "badge-configured"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>{t.reason.slice(0, 60)}{t.reason.length > 60 ? "..." : ""}</td>
                  <td>{t.taken_by ? t.taken_by.slice(0, 8) : "—"}</td>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link
                      href={`/tickets/${encodeURIComponent(t.id)}`}
                      className="btn btn-secondary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
