"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelLockIcon,
  PixelPauseIcon,
  PixelShieldAlertIcon,
} from "@/components/PixelIcons";
import {
  resolveFormCategory,
  resolveKbmAccent,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface TicketListItem {
  id: string;
  form_id: string;
  submission_id: string | null;
  user_id: string;
  kind: "appeal" | "complaint";
  reason: string;
  status: "open" | "taken" | "resolved" | "reopened" | "closed";
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

function formatTicketStatusLabel(status: TicketListItem["status"]): string {
  switch (status) {
    case "open":
      return "OPEN · PENDING REVIEW";
    case "taken":
      return "IN REVIEW · ASSIGNED";
    case "resolved":
      return "RESOLVED";
    case "reopened":
      return "REOPENED";
    case "closed":
      return "CLOSED";
    default:
      return String(status).toUpperCase();
  }
}

export default function TicketsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [complaintForms, setComplaintForms] = useState<FormRow[]>([]);
  const [formsTitleMap, setFormsTitleMap] = useState<Record<string, string>>({});
  const [themesMap, setThemesMap] = useState<Record<string, FormTheme>>({});
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [viewMode, setViewMode] = useState<"all" | "forms" | "tickets">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const [{ data: prof }, { data: fRows }, { data: tRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase
            .from("forms")
            .select("*")
            .eq("state", "published")
            .order("title", { ascending: true }),
          supabase
            .from("tickets")
            .select("id,form_id,submission_id,user_id,kind,reason,status,resolution,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);

        const allForms = (fRows as FormRow[] | null) ?? [];
        const titleMap: Record<string, string> = {};
        for (const f of allForms) titleMap[f.id] = f.title;
        setFormsTitleMap(titleMap);

        const tMap: Record<string, FormTheme> = {};
        if (allForms.length > 0) {
          const { data: verRows } = await supabase
            .from("form_versions")
            .select("form_id,version_number,theme_json")
            .in(
              "form_id",
              allForms.map((f) => f.id),
            )
            .eq("is_published", true);

          if (!active) return;
          for (const f of allForms) {
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

        const filtered = allForms.filter(
          (f) => resolveFormCategory(f, tMap[f.id]) === "staff_complaints",
        );

        setThemesMap(tMap);
        setComplaintForms(filtered);
        setTickets((tRows as TicketListItem[] | null) ?? []);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <ChunkLoader title="Staff Complaints" subtitle="Loading forms & tickets..." />;
  }

  if (!profile) {
    return (
      <section className="card stack">
        <h1>Sign In Required</h1>
        <p className="notice">
          Please sign in with your invited company email address to view and submit complaints.
        </p>
        <div className="row-actions">
          <Link href="/sign-in/" className="pixel-paper-btn primary">
            Sign in with Email OTP
          </Link>
        </div>
      </section>
    );
  }

  const isStaffAdmin = profile.role === "admin" || profile.role === "maintenance";
  const myTickets = isStaffAdmin ? tickets : tickets.filter((t) => t.user_id === profile.id);

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="app-mobile-nav">
        <Link href="/" className="pixel-paper-btn compact">
          <PixelArrowLeftIcon size={13} />
          <span>Main Menu</span>
        </Link>
        <span className="app-mobile-nav-title">Staff Complaints</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Quick View Switcher: Submit Forms + Live Ticket Tracker */}
      <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className={`pixel-paper-btn compact ${viewMode === "all" ? "primary" : ""}`}
          onClick={() => setViewMode("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`pixel-paper-btn compact ${viewMode === "tickets" ? "primary" : ""}`}
          onClick={() => setViewMode("tickets")}
        >
          <PixelShieldAlertIcon size={12} />
          <span>
            {isStaffAdmin ? "Complaint Tickets" : "My Tickets & Status"} ({myTickets.length})
          </span>
        </button>
        <button
          type="button"
          className={`pixel-paper-btn compact ${viewMode === "forms" ? "primary" : ""}`}
          onClick={() => setViewMode("forms")}
        >
          Submit Complaint ({complaintForms.length})
        </button>
      </div>

      {/* SECTION 1: SUBMIT COMPLAINT FORMS */}
      {(viewMode === "all" || viewMode === "forms") && (
        <div className="stack" style={{ gap: "0.65rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Submit a Confidential Complaint</h2>
          {complaintForms.length === 0 ? (
            <section className="card" style={{ margin: 0 }}>
              <p className="notice" style={{ margin: 0 }}>
                No complaint forms published yet.
              </p>
            </section>
          ) : (
            <div className="grid-2">
              {complaintForms.map((f) => {
                const fTheme = themesMap[f.id];
                const accent = resolveKbmAccent(fTheme?.primaryColor, "staff_complaints");
                const isPaused = Boolean(fTheme?.submissionsClosed);

                if (isPaused) {
                  return (
                    <section
                      key={f.id}
                      className="card stack catalog-form-card paused"
                      style={{
                        margin: 0,
                        borderTop: "6px solid #94a3b8",
                      }}
                    >
                      {fTheme?.bannerImageUrl && (
                        <div className="catalog-banner-thumb">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fTheme.bannerImageUrl} alt={f.title} />
                        </div>
                      )}

                      <div className="row-between" style={{ alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>{f.title}</strong>
                        <span className="pixel-stamp-badge paused">
                          <PixelPauseIcon size={10} />
                          <span>CLOSED</span>
                        </span>
                      </div>

                      <div className="gf-paused-reason-strip">
                        <PixelLockIcon size={13} />
                        <span>
                          {fTheme?.closedReason || "Submissions are currently closed."}
                        </span>
                      </div>
                    </section>
                  );
                }

                return (
                  <Link
                    key={f.id}
                    href={`/forms/fill/?id=${encodeURIComponent(f.id)}`}
                    className="card stack catalog-form-card"
                    style={{
                      margin: 0,
                      borderTop: `6px solid ${accent}`,
                      textDecoration: "none",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    {fTheme?.bannerImageUrl && (
                      <div className="catalog-banner-thumb">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fTheme.bannerImageUrl} alt={f.title} />
                      </div>
                    )}

                    <div className="row-between" style={{ alignItems: "center", gap: "0.5rem" }}>
                      <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>{f.title}</strong>
                      <PixelArrowRightIcon size={16} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: SUBMITTED TICKETS & LIVE STATUS HISTORY (ALWAYS PERSISTENT!) */}
      {(viewMode === "all" || viewMode === "tickets") && (
        <div className="stack" style={{ gap: "0.65rem" }}>
          <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
              {isStaffAdmin ? "Active & Submitted Tickets" : "My Submitted Tickets & Live Status"} (
              {myTickets.length})
            </h2>
          </div>

          {myTickets.length === 0 ? (
            <section className="card" style={{ margin: 0 }}>
              <p className="notice" style={{ margin: 0 }}>
                No submitted complaint tickets yet. Once you submit a complaint form above, your
                ticket will appear here permanently so you can check its live status and messages
                anytime.
              </p>
            </section>
          ) : (
            <div className="stack" style={{ gap: "0.7rem" }}>
              {myTickets.map((t) => {
                const isDone = t.status === "resolved" || t.status === "closed";
                const isInReview = t.status === "taken";
                const statusClass = isDone || isInReview ? "live" : "draft";
                const formName = formsTitleMap[t.form_id] || "Staff Complaint Report";
                const previewLine =
                  t.reason.length > 140 ? `${t.reason.slice(0, 140)}...` : t.reason;

                return (
                  <Link
                    key={t.id}
                    href={`/tickets/ticket-id/?id=${encodeURIComponent(t.id)}`}
                    className="card stack catalog-form-card"
                    style={{
                      margin: 0,
                      borderLeft: `6px solid ${isDone || isInReview ? "#0f5132" : "#c59333"}`,
                      textDecoration: "none",
                      color: "inherit",
                      gap: "0.45rem",
                    }}
                  >
                    <div className="row-between" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.98rem", color: "var(--ink)" }}>
                          {formName}
                        </strong>
                        <span className="pixel-tag-pill">#{t.id.slice(0, 8)}</span>
                      </div>
                      <span className={`pixel-stamp-badge ${statusClass}`}>
                        {formatTicketStatusLabel(t.status)}
                      </span>
                    </div>

                    <p
                      className="notice"
                      style={{
                        margin: 0,
                        fontSize: "0.84rem",
                        color: "var(--ink-secondary)",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {previewLine}
                    </p>

                    {t.resolution && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          padding: "0.45rem 0.65rem",
                          borderRadius: "6px",
                          background: "var(--ok-bg)",
                          border: "1px solid var(--ok-border)",
                          color: "var(--ok-text)",
                        }}
                      >
                        <strong>Resolution:</strong> {t.resolution}
                      </div>
                    )}

                    <div className="row-between" style={{ alignItems: "center", marginTop: "0.1rem" }}>
                      <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>
                        Submitted: {new Date(t.created_at).toLocaleString()}
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "var(--accent)",
                        }}
                      >
                        <span>View Status &amp; Messages</span>
                        <PixelArrowRightIcon size={12} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
