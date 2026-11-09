"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  created_at: string;
  updated_at: string;
}

interface FormOption {
  id: string;
  title: string;
}

interface SubmissionOption {
  id: string;
  form_id: string;
  created_at: string;
}

export default function TicketsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Ticket Composer State
  const [showComposer, setShowComposer] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("new") === "1";
  });
  const [kind, setKind] = useState<"complaint" | "appeal">(() => {
    if (typeof window === "undefined") return "complaint";
    const k = new URLSearchParams(window.location.search).get("kind");
    return k === "appeal" ? "appeal" : "complaint";
  });
  const [selectedFormId, setSelectedFormId] = useState<string>("");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTicketsData = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;

      const [{ data: prof }, { data: tRows }, { data: fRows }, { data: subRows }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("tickets").select("*").order("created_at", { ascending: false }),
          supabase.from("forms").select("id,title").order("title", { ascending: true }),
          supabase
            .from("submissions")
            .select("id,form_id,created_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false }),
        ]);

      const typedProf = (prof as UserProfile | null) ?? null;
      setProfile(typedProf);

      const formList = (fRows as FormOption[] | null) ?? [];
      setForms(formList);
      if (formList.length > 0) {
        setSelectedFormId((prev) => prev || formList[0].id);
      }

      setSubmissions((subRows as SubmissionOption[] | null) ?? []);

      const isAdminOrMaint =
        typedProf && (typedProf.role === "admin" || typedProf.role === "maintenance");
      const allTickets = (tRows as TicketRow[] | null) ?? [];
      setTickets(isAdminOrMaint ? allTickets : allTickets.filter((t) => t.user_id === uid));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      if (active) {
        await loadTicketsData();
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [loadTicketsData]);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFormId) {
      setError("Please select a related form for this ticket.");
      return;
    }
    if (!reason.trim()) {
      setError("Please enter the details of your complaint or appeal.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase.rpc("create_ticket", {
        p_form_id: selectedFormId,
        p_submission_id: selectedSubmissionId ? selectedSubmissionId : null,
        p_kind: kind,
        p_reason: reason.trim(),
      });

      if (rpcErr) throw rpcErr;

      setReason("");
      setSelectedSubmissionId("");
      setShowComposer(false);
      setSuccessMsg(
        `Your ${kind === "complaint" ? "complaint" : "appeal"} ticket has been submitted to the support team.`,
      );
      await loadTicketsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="Complaints & Appeals" subtitle="Loading support desk..." />;
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Sign In Required</h1>
          <p className="notice">
            Please sign in with your invited company email to submit or view complaints and appeals.
          </p>
          <div className="row-actions">
            <Link href="/sign-in/" className="btn btn-accent">
              Sign in with Email Passcode
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const isAdminOrMaint = profile.role === "admin" || profile.role === "maintenance";
  const formMap = Object.fromEntries(forms.map((f) => [f.id, f.title]));
  const matchingSubmissions = submissions.filter((s) => s.form_id === selectedFormId);

  return (
    <div className="stack">
      {/* Header Banner */}
      <section className="card row-between">
        <div>
          <span className="badge badge-admin" style={{ marginBottom: "0.45rem" }}>
            Support &amp; Resolution Desk
          </span>
          <h1>Complaints &amp; Appeals</h1>
          <p className="notice">
            {isAdminOrMaint
              ? "Review incoming operational complaints and application appeals, claim open tickets, and respond to members."
              : "Submit a new operational complaint or appeal a form decision, and track real-time responses from staff."}
          </p>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className={`btn ${showComposer ? "btn-secondary" : "btn-primary"}`}
            onClick={() => {
              setShowComposer((prev) => !prev);
              setError(null);
            }}
          >
            {showComposer ? "Close Form" : "+ New Complaint / Appeal"}
          </button>
        </div>
      </section>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {successMsg && (
        <p className="alert alert-ok" role="status">
          {successMsg}
        </p>
      )}

      {/* New Complaint / Appeal Composer */}
      {showComposer && (
        <section className="card stack" style={{ borderColor: "var(--accent-border)" }}>
          <div className="row-between">
            <div>
              <h2>Lodge New Complaint or Appeal</h2>
              <p className="notice">
                Provide clear details below so our administrative team can investigate and respond promptly.
              </p>
            </div>
          </div>

          {forms.length === 0 ? (
            <div className="alert alert-error">
              At least one company form must exist in the system before a ticket can be categorized.{" "}
              {isAdminOrMaint && (
                <Link href="/admin/forms/" style={{ fontWeight: 700, textDecoration: "underline" }}>
                  Create a form in Form Builder &rarr;
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateTicket} className="stack">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="ticket-kind">Ticket Category</label>
                  <select
                    id="ticket-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as "complaint" | "appeal")}
                  >
                    <option value="complaint">Operational Complaint (Aduan Operasi)</option>
                    <option value="appeal">Application / Submission Appeal (Rayuan)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="ticket-form">Related Form / Department</label>
                  <select
                    id="ticket-form"
                    value={selectedFormId}
                    onChange={(e) => {
                      setSelectedFormId(e.target.value);
                      setSelectedSubmissionId("");
                    }}
                  >
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {matchingSubmissions.length > 0 && (
                <div className="field">
                  <label htmlFor="ticket-sub">Link to Your Previous Submission (Optional)</label>
                  <select
                    id="ticket-sub"
                    value={selectedSubmissionId}
                    onChange={(e) => setSelectedSubmissionId(e.target.value)}
                  >
                    <option value="">— No specific submission / General —</option>
                    {matchingSubmissions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Submission #{s.id.slice(0, 8)} ({new Date(s.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label htmlFor="ticket-reason">Description &amp; Reason</label>
                <textarea
                  id="ticket-reason"
                  rows={4}
                  placeholder="Describe the issue, operational complaint, or grounds for appeal in detail..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="row-actions">
                <button type="submit" className="btn btn-accent" disabled={submitting}>
                  {submitting ? "Submitting Ticket..." : "Submit Ticket"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Tickets List Table */}
      <section className="card stack">
        <div className="row-between">
          <h2>{isAdminOrMaint ? `All Tickets (${tickets.length})` : `Your Tickets (${tickets.length})`}</h2>
        </div>

        {tickets.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2.5rem 1rem",
              background: "var(--surface-muted)",
              borderRadius: "var(--radius)",
              border: "1px dashed var(--border-strong)",
            }}
          >
            <p className="notice" style={{ marginBottom: "0.85rem" }}>
              {isAdminOrMaint
                ? "No complaint or appeal tickets have been submitted yet."
                : "You have not submitted any complaints or appeals yet."}
            </p>
            {!showComposer && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowComposer(true)}
              >
                + Lodge Your First Complaint or Appeal
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Related Form</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>#{t.id.slice(0, 8)}</code>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          t.kind === "appeal" ? "badge-admin" : "badge-not_configured"
                        }`}
                      >
                        {t.kind}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {formMap[t.form_id] ?? t.form_id.slice(0, 8)}
                    </td>
                    <td style={{ maxWidth: "280px" }}>
                      {t.reason.slice(0, 70)}
                      {t.reason.length > 70 ? "..." : ""}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          t.status === "resolved" || t.status === "closed"
                            ? "badge-configured"
                            : t.status === "taken"
                            ? "badge-admin"
                            : "badge-not_configured"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/tickets/${encodeURIComponent(t.id)}`}
                        className="btn btn-secondary"
                        style={{ padding: "0.3rem 0.65rem", fontSize: "0.8rem" }}
                      >
                        Open Thread &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
