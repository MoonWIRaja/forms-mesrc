"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelLockIcon,
  PixelPauseIcon,
  PixelPlusIcon,
  PixelShieldAlertIcon,
  PixelSparkleIcon,
} from "@/components/PixelIcons";
import {
  resolveFormCategory,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
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

interface SubmissionOption {
  id: string;
  form_id: string;
  created_at: string;
}

export default function TicketsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [allForms, setAllForms] = useState<FormRow[]>([]);
  const [complaintForms, setComplaintForms] = useState<FormRow[]>([]);
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [submissions, setSubmissions] = useState<SubmissionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Quick Direct Ticket Composer State
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
          supabase
            .from("forms")
            .select("*")
            .eq("state", "published")
            .order("title", { ascending: true }),
          supabase
            .from("submissions")
            .select("id,form_id,created_at")
            .eq("user_id", uid)
            .order("created_at", { ascending: false }),
        ]);

      const typedProf = (prof as UserProfile | null) ?? null;
      setProfile(typedProf);

      const formList = (fRows as FormRow[] | null) ?? [];
      setAllForms(formList);

      const tMap: Record<string, FormTheme> = {};
      if (formList.length > 0) {
        const { data: verRows } = await supabase
          .from("form_versions")
          .select("form_id,version_number,theme_json")
          .in(
            "form_id",
            formList.map((f) => f.id),
          )
          .eq("is_published", true);

        for (const f of formList) {
          const match = (
            verRows as { form_id: string; version_number: number; theme_json: FormTheme }[] | null
          )?.find(
            (v) =>
              v.form_id === f.id &&
              v.version_number === (f.current_published_version ?? f.latest_version),
          );
          if (match?.theme_json) tMap[f.id] = match.theme_json;
        }
      }
      setThemesMap(tMap);

      const cForms = formList.filter(
        (f) => resolveFormCategory(f, tMap[f.id]) === "staff_complaints",
      );
      setComplaintForms(cForms);

      if (formList.length > 0) {
        setSelectedFormId((prev) => prev || cForms[0]?.id || formList[0].id);
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
        `Your ${kind === "complaint" ? "complaint" : "appeal"} has been logged under ${profile?.email ?? "your account"}. Track real-time updates below.`,
      );
      await loadTicketsData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="Staff Complaints" subtitle="Loading complaints & status desk..." />;
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Sign In Required</h1>
          <p className="notice">
            Please sign in with your invited company email to submit or track complaints and appeals.
          </p>
          <div className="row-actions">
            <Link href="/sign-in/" className="pixel-paper-btn primary">
              Sign in with Email OTP
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const isAdminOrMaint = profile.role === "admin" || profile.role === "maintenance";
  const formMap = Object.fromEntries(allForms.map((f) => [f.id, f.title]));
  const matchingSubmissions = submissions.filter((s) => s.form_id === selectedFormId);

  return (
    <div className="stack">
      <div className="app-mobile-nav">
        <Link href="/" className="pixel-paper-btn compact">
          <PixelArrowLeftIcon size={13} />
          <span>Main Menu</span>
        </Link>
        <span className="app-mobile-nav-title">Staff Complaints</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Header Banner */}
      <section className="card stack">
        <div className="row-between" style={{ alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
              <PixelShieldAlertIcon size={18} />
              <span className="pixel-tag-pill">COMPLAINTS &amp; STATUS TRACKER</span>
            </div>
            <h1 style={{ margin: "0 0 0.25rem" }}>Staff Complaints &amp; Appeals</h1>
            <p className="notice" style={{ margin: 0 }}>
              {isAdminOrMaint
                ? "Review incoming staff complaints, claim open tickets, and update resolution statuses."
                : "Submit a confidential report or check real-time status on your submitted complaints."}
            </p>
          </div>

          <div className="row-actions" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className={`pixel-paper-btn ${showComposer ? "" : "primary"}`}
              onClick={() => {
                setShowComposer((prev) => !prev);
                setError(null);
              }}
            >
              <PixelPlusIcon size={14} />
              <span>{showComposer ? "Close Quick Report" : "Quick Complaint / Appeal"}</span>
            </button>
            <Link href="/" className="pixel-paper-btn compact">
              <PixelArrowLeftIcon size={13} />
              <span>Home</span>
            </Link>
          </div>
        </div>

        {/* Auto-filled logged-in email banner */}
        <div className="gf-account-strip">
          <PixelLockIcon size={13} />
          <span>
            Auto-verified account: <strong>{profile.email}</strong> — No email input required when reporting or checking status.
          </span>
        </div>
      </section>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {successMsg && (
        <div className="alert alert-ok" role="status">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Structured Complaint Forms built in Form Studio */}
      {complaintForms.length > 0 && (
        <div className="grid-2">
          {complaintForms.map((f) => {
            const fTheme = themesMap[f.id];
            const accent = fTheme?.primaryColor || "#be123c";
            const isPaused = Boolean(fTheme?.submissionsClosed);

            return (
              <section
                key={f.id}
                className={`card stack catalog-form-card ${isPaused ? "paused" : ""}`}
                style={{
                  margin: 0,
                  borderTop: `6px solid ${isPaused ? "#94a3b8" : accent}`,
                }}
              >
                {fTheme?.bannerImageUrl && (
                  <div className="catalog-banner-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fTheme.bannerImageUrl} alt={f.title} />
                  </div>
                )}

                <div className="row-between" style={{ alignItems: "flex-start", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "1.05rem" }}>{f.title}</strong>
                  {isPaused ? (
                    <span className="pixel-stamp-badge paused">
                      <PixelPauseIcon size={10} />
                      <span>CLOSED</span>
                    </span>
                  ) : (
                    <span className="pixel-stamp-badge live">
                      <PixelSparkleIcon size={10} />
                      <span>COMPLAINT FORM</span>
                    </span>
                  )}
                </div>

                {f.description && (
                  <p className="notice" style={{ margin: 0 }}>
                    {f.description}
                  </p>
                )}

                {isPaused && (
                  <div className="gf-paused-reason-strip">
                    <PixelLockIcon size={13} />
                    <span>{fTheme?.closedReason || "Form entries are currently paused."}</span>
                  </div>
                )}

                <div className="row-actions" style={{ marginTop: "auto", paddingTop: "0.4rem" }}>
                  {isPaused ? (
                    <button type="button" className="pixel-paper-btn" disabled>
                      <PixelLockIcon size={14} />
                      <span>Submissions Closed</span>
                    </button>
                  ) : (
                    <Link
                      href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                      className="pixel-paper-btn primary"
                      style={{ backgroundColor: accent }}
                    >
                      <PixelShieldAlertIcon size={14} />
                      <span>File Report via Form</span>
                      <PixelArrowRightIcon size={14} />
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Quick Direct Complaint / Appeal Composer */}
      {showComposer && (
        <section className="card stack" style={{ borderColor: "var(--ink)" }}>
          <div className="row-between">
            <div>
              <h2>Quick Complaint or Appeal</h2>
              <p className="notice">
                Submitted directly under <strong>{profile.email}</strong>. Track progress anytime below.
              </p>
            </div>
          </div>

          {allForms.length === 0 ? (
            <div className="alert alert-error">
              At least one company form must exist before logging a ticket.{" "}
              {isAdminOrMaint && (
                <Link href="/admin/forms/" style={{ fontWeight: 700, textDecoration: "underline" }}>
                  Create a form in Studio &rarr;
                </Link>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateTicket} className="stack">
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="ticket-kind">Report Type</label>
                  <select
                    id="ticket-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value as "complaint" | "appeal")}
                  >
                    <option value="complaint">Operational Complaint / Incident</option>
                    <option value="appeal">Application / Decision Appeal</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="ticket-form">Related Category / Form</label>
                  <select
                    id="ticket-form"
                    value={selectedFormId}
                    onChange={(e) => {
                      setSelectedFormId(e.target.value);
                      setSelectedSubmissionId("");
                    }}
                  >
                    {allForms.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {matchingSubmissions.length > 0 && (
                <div className="field">
                  <label htmlFor="ticket-sub">Link to Your Submission (Optional)</label>
                  <select
                    id="ticket-sub"
                    value={selectedSubmissionId}
                    onChange={(e) => setSelectedSubmissionId(e.target.value)}
                  >
                    <option value="">— General Complaint —</option>
                    {matchingSubmissions.map((s) => (
                      <option key={s.id} value={s.id}>
                        Submission #{s.id.slice(0, 8)} ({new Date(s.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="field">
                <label htmlFor="ticket-reason">Complaint / Appeal Details</label>
                <textarea
                  id="ticket-reason"
                  rows={4}
                  placeholder="Describe the issue clearly so support staff can resolve it quickly..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="row-actions">
                <button type="submit" className="pixel-paper-btn primary" disabled={submitting}>
                  <span>{submitting ? "Submitting..." : "Submit Report"}</span>
                  <PixelArrowRightIcon size={14} />
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn"
                  onClick={() => setShowComposer(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Live Complaint Status Tracker */}
      <section className="card stack">
        <div className="row-between">
          <div>
            <h2>
              {isAdminOrMaint
                ? `All Complaints & Appeals (${tickets.length})`
                : `My Complaint Status Tracker (${tickets.length})`}
            </h2>
            <p className="notice" style={{ margin: 0 }}>
              Open any ticket to view admin notes, real-time resolution status, and reply thread.
            </p>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="gf-empty-stream-card">
            <PixelShieldAlertIcon size={28} className="gf-empty-pixel-icon" />
            <p className="notice" style={{ margin: 0 }}>
              {isAdminOrMaint
                ? "No complaint or appeal tickets have been submitted yet."
                : "You have no active complaints or appeals."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Type</th>
                  <th>Form / Source</th>
                  <th>Summary</th>
                  <th>Live Status</th>
                  <th>Submitted</th>
                  <th>Track</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>#{t.id.slice(0, 8)}</code>
                    </td>
                    <td>
                      <span className="pixel-tag-pill">{t.kind.toUpperCase()}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--ink)" }}>
                      {formMap[t.form_id] ?? t.form_id.slice(0, 8)}
                    </td>
                    <td style={{ maxWidth: "280px" }}>
                      {t.reason.slice(0, 75)}
                      {t.reason.length > 75 ? "..." : ""}
                    </td>
                    <td>
                      <span
                        className={`pixel-stamp-badge ${
                          t.status === "resolved" || t.status === "closed"
                            ? "live"
                            : t.status === "taken"
                              ? "paused"
                              : "draft"
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/tickets/ticket-id/?id=${encodeURIComponent(t.id)}`}
                        className="pixel-paper-btn compact"
                      >
                        <span>Check Status</span>
                        <PixelArrowRightIcon size={12} />
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
