"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelDateIcon,
  PixelQuestionsIcon,
  PixelShieldAlertIcon,
  PixelStarIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  getLocalNowParts,
  resolveFormCategory,
  type FormFieldNode,
  type FormRow,
  type FormTheme,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface AdminSubmissionRow {
  id: string;
  form_id: string;
  form_version: number;
  user_id: string;
  status: string;
  answers_json: Record<string, unknown>;
  duration_seconds: number | null;
  submitted_at: string | null;
  created_at: string;
}

interface FormVersionMeta {
  form_id: string;
  version_number: number;
  schema_json: FormFieldNode[];
  theme_json: FormTheme;
}

interface TicketMeta {
  id: string;
  submission_id: string | null;
  status: string;
}

function toLocalDateKey(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AdminPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [formsList, setFormsList] = useState<FormRow[]>([]);
  const [formsMap, setFormsMap] = useState<Record<string, FormRow>>({});
  const [versionsMap, setVersionsMap] = useState<Record<string, FormVersionMeta>>({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [ticketsBySubId, setTicketsBySubId] = useState<Record<string, TicketMeta>>({});

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalNowParts().date);
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const [
          { data: prof },
          { data: subRows },
          { data: fRows },
          { data: uRows },
          { data: vRows },
          { data: tRows },
        ] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase
            .from("submissions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(400),
          supabase
            .from("forms")
            .select("*")
            .neq("state", "archived")
            .order("updated_at", { ascending: false }),
          supabase.from("profiles").select("id,email"),
          supabase.from("form_versions").select("form_id,version_number,schema_json,theme_json"),
          supabase.from("tickets").select("id,submission_id,status"),
        ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setSubmissions((subRows as AdminSubmissionRow[] | null) ?? []);
        const fList = (fRows as FormRow[] | null) ?? [];
        setFormsList(fList);
        setFormsMap(Object.fromEntries(fList.map((f) => [f.id, f])));
        setUsersMap(
          Object.fromEntries(
            ((uRows as { id: string; email: string }[] | null) ?? []).map((u) => [u.id, u.email]),
          ),
        );
        const vMap: Record<string, FormVersionMeta> = {};
        for (const v of (vRows as FormVersionMeta[] | null) ?? []) {
          vMap[`${v.form_id}:${v.version_number}`] = v;
        }
        setVersionsMap(vMap);

        const tMap: Record<string, TicketMeta> = {};
        for (const t of (tRows as TicketMeta[] | null) ?? []) {
          if (t.submission_id) tMap[t.submission_id] = t;
        }
        setTicketsBySubId(tMap);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <ChunkLoader title="Admin Panel" subtitle="Loading submissions & forms..." />;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">Only Admin or Maintenance accounts may access the Admin Panel.</p>
          <div className="row-actions">
            <Link href="/" className="pixel-paper-btn primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const todayKey = getLocalNowParts().date;
  const activeForm = selectedFormId ? formsMap[selectedFormId] : null;
  const activeFormVer = activeForm
    ? versionsMap[
        `${activeForm.id}:${activeForm.current_published_version ?? activeForm.latest_version}`
      ]
    : undefined;
  const activeCategory = activeForm
    ? resolveFormCategory(activeForm, activeFormVer?.theme_json)
    : "company_forms";

  const formSubmissions = selectedFormId
    ? submissions.filter((s) => {
        if (s.form_id !== selectedFormId) return false;
        if (!selectedDate) return true;
        return toLocalDateKey(s.submitted_at ?? s.created_at) === selectedDate;
      })
    : [];

  // Voting Leaderboard calculation when viewing a Voting & Evaluation form
  const activeSchema = activeFormVer?.schema_json ?? [];
  const ratingNodes = activeSchema.filter(
    (n) => n.type === "star_rating" || n.type === "linear_scale",
  );
  const targetGroupNode = activeSchema.find(
    (n) => n.type === "dropdown" || n.type === "single_choice",
  );

  const leaderboardRows = (() => {
    if (activeCategory !== "voting_evaluation" || ratingNodes.length === 0) return [];
    const submittedOnly = formSubmissions.filter((s) => s.status === "submitted");
    const maxPossible = ratingNodes.reduce(
      (acc, n) => acc + (n.maxRating ?? (n.type === "linear_scale" ? 10 : 5)),
      0,
    );
    const groups: Record<string, AdminSubmissionRow[]> = {};
    for (const s of submittedOnly) {
      const key = targetGroupNode
        ? String(s.answers_json[targetGroupNode.id] || "Unspecified")
        : "Overall";
      groups[key] = [...(groups[key] ?? []), s];
    }
    return Object.entries(groups)
      .map(([candidate, ballots]) => {
        const perCriterion: Record<string, number> = {};
        let avgTotal = 0;
        for (const r of ratingNodes) {
          let sum = 0;
          let cnt = 0;
          for (const b of ballots) {
            const val = Number(b.answers_json[r.id]);
            if (!Number.isNaN(val) && val > 0) {
              sum += val;
              cnt += 1;
            }
          }
          const avg = cnt > 0 ? sum / cnt : 0;
          perCriterion[r.id] = avg;
          avgTotal += avg;
        }
        return { candidate, ballots: ballots.length, avgTotal, maxPossible, perCriterion };
      })
      .sort((a, b) => b.avgTotal - a.avgTotal);
  })();

  const selectedSubSchema = selectedSub
    ? versionsMap[`${selectedSub.form_id}:${selectedSub.form_version}`]?.schema_json ?? []
    : [];

  return (
    <div className="stack" style={{ flex: 1 }}>
      {!selectedFormId && (
        <section
          className="card stack admin-full-card"
          style={{ flex: 1, height: "calc(100dvh - 2.5rem)", margin: 0, overflow: "hidden" }}
        >
          <div className="row-between">
            <h2 style={{ margin: 0 }}>Select a Form ({formsList.length})</h2>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 4px" }}>
            {formsList.length === 0 ? (
              <div className="gf-empty-stream-card">
                <p className="notice" style={{ margin: 0 }}>
                  No forms created yet.
                </p>
              </div>
            ) : (
              <div className="stack" style={{ gap: "0.75rem" }}>
                {formsList.map((f) => {
                  const ver = versionsMap[`${f.id}:${f.latest_version}`];
                  const fTheme = ver?.theme_json;
                  const fCat = resolveFormCategory(f, fTheme);
                  const catLabel = FORM_CATEGORIES.find((c) => c.key === fCat)?.label ?? fCat;
                  const allCount = submissions.filter((s) => s.form_id === f.id).length;
                  const todayCount = submissions.filter(
                    (s) =>
                      s.form_id === f.id &&
                      toLocalDateKey(s.submitted_at ?? s.created_at) === todayKey,
                  ).length;
                  const accent = fTheme?.primaryColor || "#1d4ed8";

                  return (
                    <div
                      key={f.id}
                      className="card row-between catalog-form-card"
                      style={{
                        margin: 0,
                        width: "100%",
                        borderLeft: `6px solid ${accent}`,
                        padding: "0.9rem 1.25rem",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", minWidth: "240px", flex: 1 }}>
                        <strong style={{ color: "var(--ink)", fontSize: "1rem" }}>{f.title}</strong>
                        <span className="pixel-tag-pill">{catLabel}</span>
                        <span className={`pixel-stamp-badge ${todayCount > 0 ? "live" : "draft"}`}>
                          {todayCount} TODAY
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {allCount} total submissions
                        </span>
                      </div>

                      <div className="row-actions">
                        <button
                          type="button"
                          className="pixel-paper-btn compact primary"
                          style={{ backgroundColor: accent }}
                          onClick={() => {
                            setSelectedFormId(f.id);
                            setSelectedDate(todayKey);
                            setSelectedSub(null);
                          }}
                        >
                          <span>View Submissions</span>
                          <PixelArrowRightIcon size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {selectedFormId && activeForm && (
        <section
          className="card stack admin-full-card"
          style={{ flex: 1, minHeight: "calc(100dvh - 2.5rem)", margin: 0 }}
        >
          <div className="row-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="pixel-paper-btn compact"
                onClick={() => {
                  setSelectedFormId(null);
                  setSelectedSub(null);
                }}
              >
                <PixelArrowLeftIcon size={12} />
                <span>All Forms</span>
              </button>
              <div>
                <h2 style={{ margin: 0 }}>{activeForm.title}</h2>
                <span className="pixel-tag-pill" style={{ marginTop: "0.2rem" }}>
                  {FORM_CATEGORIES.find((c) => c.key === activeCategory)?.label}
                </span>
              </div>
            </div>

            {/* Date Filter Controls */}
            <div className="row-actions" style={{ gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
              <PixelDateIcon size={15} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSub(null);
                }}
                style={{ width: "165px" }}
              />
              <button
                type="button"
                className={`pixel-paper-btn compact ${selectedDate === todayKey ? "primary" : ""}`}
                onClick={() => {
                  setSelectedDate(todayKey);
                  setSelectedSub(null);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className={`pixel-paper-btn compact ${selectedDate === "" ? "primary" : ""}`}
                onClick={() => {
                  setSelectedDate("");
                  setSelectedSub(null);
                }}
              >
                All Dates
              </button>
            </div>
          </div>

          {/* Judging Leaderboard when viewing Voting & Evaluation form */}
          {activeCategory === "voting_evaluation" && leaderboardRows.length > 0 && (
            <div className="card stack" style={{ background: "var(--surface-muted)", margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <PixelStarIcon size={16} />
                <h3 style={{ margin: 0 }}>
                  Judging Scoreboard {selectedDate ? `(${selectedDate})` : "(All Dates)"}
                </h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>{targetGroupNode ? targetGroupNode.label : "Entry"}</th>
                      <th>Judges</th>
                      {ratingNodes.map((r) => (
                        <th key={r.id}>{r.label}</th>
                      ))}
                      <th>Avg Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardRows.map((row, rIdx) => (
                      <tr key={row.candidate}>
                        <td>
                          <span className={`pixel-stamp-badge ${rIdx === 0 ? "live" : "draft"}`}>
                            #{rIdx + 1}
                          </span>
                        </td>
                        <td>
                          <strong>{row.candidate}</strong>
                        </td>
                        <td>{row.ballots}</td>
                        {ratingNodes.map((r) => (
                          <td key={r.id}>
                            {(row.perCriterion[r.id] ?? 0).toFixed(1)} /{" "}
                            {r.maxRating ?? (r.type === "linear_scale" ? 10 : 5)}
                          </td>
                        ))}
                        <td>
                          <strong style={{ color: "var(--accent)" }}>
                            {row.avgTotal.toFixed(1)} / {row.maxPossible}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* User Submissions Table for Selected Form & Date */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Submitted By</th>
                  <th>Time</th>
                  <th>Status</th>
                  {activeCategory === "staff_complaints" && <th>Ticket Status</th>}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {formSubmissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={activeCategory === "staff_complaints" ? 5 : 4}
                      className="notice"
                      style={{ textAlign: "center", padding: "2rem" }}
                    >
                      No submissions found for {selectedDate || "any date"}.
                    </td>
                  </tr>
                ) : (
                  formSubmissions.map((sub) => {
                    const ticket = ticketsBySubId[sub.id];
                    return (
                      <tr key={sub.id}>
                        <td style={{ fontWeight: 700, color: "var(--ink)" }}>
                          {usersMap[sub.user_id] ?? sub.user_id.slice(0, 8)}
                        </td>
                        <td style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                          {new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}
                        </td>
                        <td>
                          <span
                            className={`pixel-stamp-badge ${
                              sub.status === "submitted" ? "live" : "draft"
                            }`}
                          >
                            {sub.status.toUpperCase()}
                          </span>
                        </td>
                        {activeCategory === "staff_complaints" && (
                          <td>
                            {ticket ? (
                              <Link
                                href={`/tickets/ticket-id/?id=${encodeURIComponent(ticket.id)}`}
                                className="pixel-paper-btn compact"
                              >
                                <PixelShieldAlertIcon size={12} />
                                <span>{ticket.status.toUpperCase()}</span>
                              </Link>
                            ) : (
                              <span className="notice">—</span>
                            )}
                          </td>
                        )}
                        <td>
                          <button
                            type="button"
                            className={`pixel-paper-btn compact ${
                              selectedSub?.id === sub.id ? "primary" : ""
                            }`}
                            onClick={() =>
                              setSelectedSub(selectedSub?.id === sub.id ? null : sub)
                            }
                          >
                            <PixelQuestionsIcon size={12} />
                            <span>{selectedSub?.id === sub.id ? "Hide Details" : "View Answers"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedSub && (
            <div className="card stack" style={{ margin: 0, background: "var(--surface-muted)" }}>
              <div className="row-between">
                <div>
                  <strong>
                    Submission by {usersMap[selectedSub.user_id] ?? selectedSub.user_id}
                  </strong>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {new Date(selectedSub.submitted_at ?? selectedSub.created_at).toLocaleString()} · v
                    {selectedSub.form_version}
                  </div>
                </div>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => setSelectedSub(null)}
                >
                  &times; Close
                </button>
              </div>

              <div className="stack" style={{ gap: "0.55rem" }}>
                {Object.entries(selectedSub.answers_json ?? {}).map(([fieldId, rawVal]) => {
                  const nodeDef = selectedSubSchema.find((n) => n.id === fieldId);
                  const displayLabel = nodeDef?.label || fieldId;
                  const formatted = Array.isArray(rawVal)
                    ? rawVal.join(", ")
                    : typeof rawVal === "object" && rawVal && "name" in rawVal
                      ? `Attached: ${(rawVal as { name: string }).name}`
                      : String(rawVal ?? "—");

                  return (
                    <div
                      key={fieldId}
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1.5px solid var(--border-strong)",
                        borderRadius: "8px",
                        padding: "0.65rem 0.85rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: "0.86rem" }}>{displayLabel}</strong>
                      {nodeDef?.type === "star_rating" ? (
                        <span className="pixel-stamp-badge draft">
                          <PixelStarIcon size={12} />
                          <span>
                            {formatted} / {nodeDef.maxRating ?? 5} STARS
                          </span>
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.88rem", color: "var(--ink)" }}>{formatted}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
