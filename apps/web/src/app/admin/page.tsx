"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelDateIcon,
  PixelLockIcon,
  PixelQuestionsIcon,
  PixelSaveIcon,
  PixelShieldAlertIcon,
  PixelStarIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  computePageScoreSummary,
  getFieldMaxMarks,
  getLocalNowParts,
  isScorableField,
  resolveFormCategory,
  splitNodesIntoPages,
  type FormCategory,
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
  kind?: string;
}

interface UserDirectoryEntry {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
}

interface JudgePageBallot {
  submissionId: string;
  judgeName: string;
  accountEmail: string;
  submittedAt: string;
  score: number;
  maxPossible: number;
  perCriterion: Record<string, number | null>;
  comment: string;
}

interface MultiPageLeaderboardEntry {
  key: string;
  pageNumber: number;
  participantName: string;
  pageSubtitle: string;
  scorableNodes: FormFieldNode[];
  maxPossible: number;
  judgeCount: number;
  avgTotal: number;
  sumTotal: number;
  perCriterionAvg: Record<string, number>;
  ballots: JudgePageBallot[];
}

function toLocalDateKey(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatAnswerValue(rawVal: unknown): string {
  if (rawVal === undefined || rawVal === null || rawVal === "") return "—";
  if (Array.isArray(rawVal)) return rawVal.join(", ");
  if (typeof rawVal === "object" && rawVal && "name" in rawVal) {
    return `Attached: ${(rawVal as { name: string }).name}`;
  }
  return String(rawVal);
}

function extractJudgeName(
  schema: FormFieldNode[],
  answers: Record<string, unknown>,
  userEntry?: UserDirectoryEntry,
): string {
  const judgeNode = schema.find(
    (n) =>
      n.syncKey === "judge_name" ||
      n.autoFillProfile === "display_name" ||
      n.label.toLowerCase().includes("judge"),
  );
  if (judgeNode) {
    const val = String(answers[judgeNode.id] ?? "").trim();
    if (val) return val;
  }
  return userEntry?.display_name || userEntry?.email || "Judge";
}

function extractPageScore(
  pageNodes: FormFieldNode[],
  answers: Record<string, unknown>,
): { score: number; maxPossible: number; scoredCount: number } {
  const summary = computePageScoreSummary(pageNodes, answers);
  const totalNode = pageNodes.find((n) => n.type === "score_total");
  if (totalNode && totalNode.allowManualOverride) {
    const raw = answers[totalNode.id];
    if (raw !== undefined && raw !== null && raw !== "") {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        return {
          score: parsed,
          maxPossible: summary.maxTotal,
          scoredCount: summary.scoredCount > 0 ? summary.scoredCount : 1,
        };
      }
    }
  }
  return {
    score: summary.total,
    maxPossible: summary.maxTotal,
    scoredCount: summary.scoredCount,
  };
}

export default function AdminPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [formsList, setFormsList] = useState<FormRow[]>([]);
  const [formsMap, setFormsMap] = useState<Record<string, FormRow>>({});
  const [versionsMap, setVersionsMap] = useState<Record<string, FormVersionMeta>>({});
  const [usersMap, setUsersMap] = useState<Record<string, UserDirectoryEntry>>({});
  const [ticketsBySubId, setTicketsBySubId] = useState<Record<string, TicketMeta>>({});

  const [categoryFilter, setCategoryFilter] = useState<FormCategory | "all">("all");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalNowParts().date);
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionRow | null>(null);
  const [selectedParticipantKey, setSelectedParticipantKey] = useState<string | null>(null);
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
            .limit(600),
          supabase
            .from("forms")
            .select("*")
            .neq("state", "archived")
            .order("updated_at", { ascending: false }),
          supabase.from("profiles").select("id,email,display_name,phone"),
          supabase.from("form_versions").select("form_id,version_number,schema_json,theme_json"),
          supabase.from("tickets").select("id,submission_id,status,kind"),
        ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setSubmissions((subRows as AdminSubmissionRow[] | null) ?? []);
        const fList = (fRows as FormRow[] | null) ?? [];
        setFormsList(fList);
        setFormsMap(Object.fromEntries(fList.map((f) => [f.id, f])));
        setUsersMap(
          Object.fromEntries(
            ((uRows as UserDirectoryEntry[] | null) ?? []).map((u) => [u.id, u]),
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
    return <ChunkLoader title="Admin Reports" subtitle="Loading submissions & scoreboards..." />;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">Only Admin or Maintenance accounts may access Admin Reports.</p>
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
      ] ?? versionsMap[`${activeForm.id}:${activeForm.latest_version}`]
    : undefined;
  const activeCategory: FormCategory = activeForm
    ? resolveFormCategory(activeForm, activeFormVer?.theme_json)
    : "company_forms";

  const formSubmissions = selectedFormId
    ? submissions.filter((s) => {
        if (s.form_id !== selectedFormId) return false;
        if (!selectedDate) return true;
        return toLocalDateKey(s.submitted_at ?? s.created_at) === selectedDate;
      })
    : [];

  const submittedOnly = formSubmissions.filter((s) => s.status === "submitted");

  // =========================================================================
  // VOTING & EVALUATION ANALYTICS (3 AUTO-DETECTED MODES)
  // =========================================================================
  const activeSchema = activeFormVer?.schema_json ?? [];
  const activeTheme = activeFormVer?.theme_json;
  const activePages = splitNodesIntoPages(activeSchema, activeTheme);
  const scorablePages = activePages.filter((p) =>
    p.items.some((it) => isScorableField(it.node)),
  );
  const isMultiPageCompetition =
    activeCategory === "voting_evaluation" && scorablePages.length > 1;

  const allScorableNodes = activeSchema.filter((n) => isScorableField(n));
  const targetGroupNode = activeSchema.find(
    (n) => n.type === "dropdown" || n.type === "single_choice",
  );
  const isSinglePageCandidateRanking =
    activeCategory === "voting_evaluation" &&
    !isMultiPageCompetition &&
    !targetGroupNode &&
    allScorableNodes.length >= 2 &&
    allScorableNodes.every((n) => n.type === "score_wheel");

  // Mode 1: Multi-Page Participant Leaderboard (e.g. 4 Speakers + Master of Ceremony)
  const multiPageLeaderboard: MultiPageLeaderboardEntry[] = (() => {
    if (!isMultiPageCompetition) return [];
    return scorablePages
      .map((page) => {
        const pageNodes = page.items.map((it) => it.node);
        const scorableNodes = pageNodes.filter((n) => isScorableField(n));
        const maxPossible = scorableNodes.reduce((acc, n) => acc + getFieldMaxMarks(n), 0);
        const participantField = pageNodes.find(
          (n) =>
            n.type === "short_text" &&
            !n.syncKey &&
            !n.autoFillProfile &&
            (n.label.toLowerCase().includes("participant") || Boolean(n.defaultValue)),
        );
        const commentField = pageNodes.find((n) => n.type === "long_text");
        const fallbackName =
          participantField?.defaultValue || page.title || `Page ${page.pageNumber}`;

        const ballots: JudgePageBallot[] = [];
        for (const sub of submittedOnly) {
          const { score, scoredCount } = extractPageScore(pageNodes, sub.answers_json);
          if (scoredCount === 0) continue;
          const userEntry = usersMap[sub.user_id];
          const judgeName = extractJudgeName(activeSchema, sub.answers_json, userEntry);
          const perCriterion: Record<string, number | null> = {};
          for (const sn of scorableNodes) {
            const raw = sub.answers_json[sn.id];
            const num = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : NaN;
            perCriterion[sn.id] = !Number.isNaN(num) ? num : null;
          }
          ballots.push({
            submissionId: sub.id,
            judgeName,
            accountEmail: userEntry?.email ?? sub.user_id.slice(0, 8),
            submittedAt: sub.submitted_at ?? sub.created_at,
            score,
            maxPossible,
            perCriterion,
            comment: commentField ? String(sub.answers_json[commentField.id] ?? "").trim() : "",
          });
        }

        const perCriterionAvg: Record<string, number> = {};
        for (const sn of scorableNodes) {
          let sum = 0;
          let cnt = 0;
          for (const b of ballots) {
            const val = b.perCriterion[sn.id];
            if (val !== null) {
              sum += val;
              cnt += 1;
            }
          }
          perCriterionAvg[sn.id] = cnt > 0 ? sum / cnt : 0;
        }

        const sumTotal = ballots.reduce((acc, b) => acc + b.score, 0);
        const avgTotal = ballots.length > 0 ? sumTotal / ballots.length : 0;

        return {
          key: `page_${page.pageNumber}`,
          pageNumber: page.pageNumber,
          participantName: fallbackName,
          pageSubtitle: page.subtitle || page.title,
          scorableNodes,
          maxPossible,
          judgeCount: ballots.length,
          avgTotal,
          sumTotal,
          perCriterionAvg,
          ballots,
        };
      })
      .sort((a, b) => b.avgTotal - a.avgTotal);
  })();

  // Mode 2: Single-Page Multi-Candidate Ranking (Competition Ranking — General)
  const singlePageCandidateRows = (() => {
    if (!isSinglePageCandidateRanking) return [];
    return allScorableNodes
      .map((node) => {
        const maxPossible = getFieldMaxMarks(node);
        let sum = 0;
        let cnt = 0;
        for (const sub of submittedOnly) {
          const raw = sub.answers_json[node.id];
          const num = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : NaN;
          if (!Number.isNaN(num)) {
            sum += num;
            cnt += 1;
          }
        }
        return {
          id: node.id,
          candidate: node.label,
          judges: cnt,
          avgScore: cnt > 0 ? sum / cnt : 0,
          sumScore: sum,
          maxPossible,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  })();

  // Mode 3: Legacy Single-Page Dropdown-Grouped Leaderboard
  const legacyLeaderboardRows = (() => {
    if (
      activeCategory !== "voting_evaluation" ||
      isMultiPageCompetition ||
      isSinglePageCandidateRanking ||
      allScorableNodes.length === 0
    ) {
      return [];
    }
    const maxPossible = allScorableNodes.reduce((acc, n) => acc + getFieldMaxMarks(n), 0);
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
        for (const r of allScorableNodes) {
          let sum = 0;
          let cnt = 0;
          for (const b of ballots) {
            const raw = b.answers_json[r.id];
            const val = raw !== undefined && raw !== null && raw !== "" ? Number(raw) : NaN;
            if (!Number.isNaN(val)) {
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

  const activeParticipantDrilldown =
    multiPageLeaderboard.find((e) => e.key === selectedParticipantKey) ??
    multiPageLeaderboard[0] ??
    null;

  // CSV Export Handler (Tailored by Form Category!)
  function handleExportCsv() {
    if (!activeForm) return;
    const dateTag = selectedDate || "all-dates";
    if (isMultiPageCompetition && multiPageLeaderboard.length > 0) {
      const rows: unknown[][] = [
        [
          "Rank",
          "Participant / Page",
          "Judges Count",
          "Average Score",
          "Max Marks",
          "Total Marks Sum",
        ],
      ];
      multiPageLeaderboard.forEach((entry, idx) => {
        rows.push([
          idx + 1,
          entry.participantName,
          entry.judgeCount,
          entry.avgTotal.toFixed(2),
          entry.maxPossible,
          entry.sumTotal,
        ]);
      });
      rows.push([]);
      rows.push([
        "Participant / Page",
        "Judge Name",
        "Judge Email",
        "Score",
        "Max Marks",
        "Comments / Recommendations",
        "Submitted At",
      ]);
      for (const entry of multiPageLeaderboard) {
        for (const b of entry.ballots) {
          rows.push([
            entry.participantName,
            b.judgeName,
            b.accountEmail,
            b.score,
            b.maxPossible,
            b.comment,
            new Date(b.submittedAt).toLocaleString(),
          ]);
        }
      }
      downloadCsv(`${activeForm.slug}-leaderboard-${dateTag}.csv`, rows);
      return;
    }

    if (isSinglePageCandidateRanking && singlePageCandidateRows.length > 0) {
      const rows: unknown[][] = [
        ["Rank", "Participant", "Judges Count", "Average Score", "Max Marks", "Total Sum"],
        ...singlePageCandidateRows.map((r, i) => [
          i + 1,
          r.candidate,
          r.judges,
          r.avgScore.toFixed(2),
          r.maxPossible,
          r.sumScore,
        ]),
      ];
      downloadCsv(`${activeForm.slug}-ranking-${dateTag}.csv`, rows);
      return;
    }

    // Standard flat CSV export for Company Forms & Staff Complaints
    const dataFields = activeSchema.filter(
      (n) =>
        n.type !== "heading" &&
        n.type !== "instructions" &&
        n.type !== "section" &&
        n.type !== "image",
    );
    const header = [
      "Submitted By Name",
      "Submitted By Email",
      "Status",
      "Submitted At",
      ...dataFields.map((f) => f.label),
    ];
    const rows: unknown[][] = [header];
    for (const sub of formSubmissions) {
      const u = usersMap[sub.user_id];
      rows.push([
        u?.display_name ?? "",
        u?.email ?? sub.user_id,
        sub.status,
        new Date(sub.submitted_at ?? sub.created_at).toLocaleString(),
        ...dataFields.map((f) => formatAnswerValue(sub.answers_json?.[f.id])),
      ]);
    }
    downloadCsv(`${activeForm.slug}-submissions-${dateTag}.csv`, rows);
  }

  // Selected submission schema + page breakdown
  const selectedSubVer = selectedSub
    ? versionsMap[`${selectedSub.form_id}:${selectedSub.form_version}`]
    : undefined;
  const selectedSubSchema = selectedSubVer?.schema_json ?? [];
  const selectedSubPages = selectedSub
    ? splitNodesIntoPages(selectedSubSchema, selectedSubVer?.theme_json)
    : [];

  // Filtered forms list on overview screen
  const filteredFormsList = formsList.filter((f) => {
    if (categoryFilter === "all") return true;
    const ver = versionsMap[`${f.id}:${f.latest_version}`];
    return resolveFormCategory(f, ver?.theme_json) === categoryFilter;
  });

  // Helper to extract Complaint preview columns
  function extractComplaintMeta(sub: AdminSubmissionRow) {
    const u = usersMap[sub.user_id];
    const nameField = activeSchema.find(
      (n) =>
        n.autoFillProfile === "display_name" ||
        n.label.toLowerCase().includes("full name") ||
        n.label.toLowerCase().includes("complainant"),
    );
    const phoneField = activeSchema.find(
      (n) => n.autoFillProfile === "phone" || n.label.toLowerCase().includes("phone"),
    );
    const catField = activeSchema.find(
      (n) =>
        n.type === "dropdown" ||
        n.type === "single_choice" ||
        n.label.toLowerCase().includes("category"),
    );
    return {
      complainantName:
        (nameField && String(sub.answers_json[nameField.id] ?? "").trim()) ||
        u?.display_name ||
        u?.email ||
        sub.user_id.slice(0, 8),
      phone:
        (phoneField && String(sub.answers_json[phoneField.id] ?? "").trim()) || u?.phone || "—",
      email: u?.email || "—",
      complaintCategory:
        (catField && String(sub.answers_json[catField.id] ?? "").trim()) ||
        (ticketsBySubId[sub.id]?.kind ? ticketsBySubId[sub.id].kind!.toUpperCase() : "General Report"),
    };
  }

  return (
    <div className="stack" style={{ flex: 1 }}>
      {/* =====================================================================
          SCREEN 1: FORM SELECTOR WITH CATEGORY FILTER
          ===================================================================== */}
      {!selectedFormId && (
        <section
          className="card stack admin-full-card"
          style={{ flex: 1, height: "calc(100dvh - 2.5rem)", margin: 0, overflow: "hidden" }}
        >
          <div className="row-between" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>Reports &amp; Submissions ({filteredFormsList.length})</h2>
              <p className="notice" style={{ margin: "0.2rem 0 0", fontSize: "0.82rem" }}>
                Choose a form to view its tailored report — Competition Scoreboards, Confidential Complaints, or Daily Form Records.
              </p>
            </div>

            <div className="row-actions" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`pixel-paper-btn compact ${categoryFilter === "all" ? "primary" : ""}`}
                onClick={() => setCategoryFilter("all")}
              >
                All ({formsList.length})
              </button>
              {FORM_CATEGORIES.map((cat) => {
                const cnt = formsList.filter((f) => {
                  const ver = versionsMap[`${f.id}:${f.latest_version}`];
                  return resolveFormCategory(f, ver?.theme_json) === cat.key;
                }).length;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    className={`pixel-paper-btn compact ${
                      categoryFilter === cat.key ? "primary" : ""
                    }`}
                    onClick={() => setCategoryFilter(cat.key)}
                  >
                    {cat.label} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 4px" }}>
            {filteredFormsList.length === 0 ? (
              <div className="gf-empty-stream-card">
                <p className="notice" style={{ margin: 0 }}>
                  No forms available in this category yet.
                </p>
              </div>
            ) : (
              <div className="stack" style={{ gap: "0.75rem" }}>
                {filteredFormsList.map((f) => {
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
                  const accent = fTheme?.primaryColor || "#0f5132";
                  const ctaLabel =
                    fCat === "voting_evaluation"
                      ? "Open Scoreboard"
                      : fCat === "staff_complaints"
                        ? "Review Cases"
                        : "View Records";

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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                          minWidth: "240px",
                          flex: 1,
                        }}
                      >
                        <strong style={{ color: "var(--ink)", fontSize: "1rem" }}>{f.title}</strong>
                        <span className="pixel-tag-pill">{catLabel}</span>
                        {f.restrict_admin_access && (
                          <span className="pixel-stamp-badge paused">
                            <PixelLockIcon size={10} />
                            <span>RESTRICTED</span>
                          </span>
                        )}
                        <span className={`pixel-stamp-badge ${todayCount > 0 ? "live" : "draft"}`}>
                          {todayCount} TODAY
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                          {allCount} total
                        </span>
                      </div>

                      <div className="row-actions">
                        <button
                          type="button"
                          className="pixel-paper-btn compact primary"
                          style={{ backgroundColor: accent }}
                          onClick={() => {
                            setSelectedFormId(f.id);
                            setSelectedDate(fCat === "company_forms" ? todayKey : "");
                            setSelectedSub(null);
                            setSelectedParticipantKey(null);
                          }}
                        >
                          <span>{ctaLabel}</span>
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

      {/* =====================================================================
          SCREEN 2: TAILORED CATEGORY REPORT VIEW
          ===================================================================== */}
      {selectedFormId && activeForm && (
        <section
          className="card stack admin-full-card"
          style={{ flex: 1, minHeight: "calc(100dvh - 2.5rem)", margin: 0 }}
        >
          {/* Header + Date Filter + Export CSV */}
          <div className="row-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="pixel-paper-btn compact"
                onClick={() => {
                  setSelectedFormId(null);
                  setSelectedSub(null);
                  setSelectedParticipantKey(null);
                }}
              >
                <PixelArrowLeftIcon size={12} />
                <span>All Forms</span>
              </button>
              <div>
                <h2 style={{ margin: 0 }}>{activeForm.title}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginTop: "0.2rem" }}>
                  <span className="pixel-tag-pill">
                    {FORM_CATEGORIES.find((c) => c.key === activeCategory)?.label}
                  </span>
                  {activeForm.restrict_admin_access && (
                    <span className="pixel-stamp-badge paused">
                      <PixelLockIcon size={10} />
                      <span>RESTRICTED ACCESS</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="row-actions" style={{ gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
              <PixelDateIcon size={15} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSub(null);
                }}
                style={{ width: "160px" }}
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
              <button
                type="button"
                className="pixel-paper-btn compact"
                onClick={handleExportCsv}
                disabled={formSubmissions.length === 0}
                title="Download report spreadsheet (.csv)"
              >
                <PixelSaveIcon size={13} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              CATEGORY A: VOTING & EVALUATION — MULTI-PAGE SCOREBOARD
              ================================================================= */}
          {activeCategory === "voting_evaluation" && isMultiPageCompetition && (
            <div className="stack" style={{ gap: "1rem" }}>
              <div className="card stack" style={{ background: "var(--surface-muted)", margin: 0 }}>
                <div className="row-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <PixelStarIcon size={17} />
                    <h3 style={{ margin: 0 }}>
                      Competition Leaderboard by Page / Participant{" "}
                      {selectedDate ? `(${selectedDate})` : "(All Dates)"}
                    </h3>
                  </div>
                  <span className="pixel-stamp-badge live">
                    {submittedOnly.length} JUDGE BALLOT{submittedOnly.length === 1 ? "" : "S"}
                  </span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Participant / Page</th>
                        <th>Judges Scored</th>
                        <th>Average Score</th>
                        <th>Total Sum</th>
                        <th>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {multiPageLeaderboard.map((entry, idx) => {
                        const isSelected = activeParticipantDrilldown?.key === entry.key;
                        return (
                          <tr
                            key={entry.key}
                            style={
                              isSelected ? { background: "rgba(15, 81, 50, 0.08)" } : undefined
                            }
                          >
                            <td>
                              <span
                                className={`pixel-stamp-badge ${
                                  idx === 0 && entry.judgeCount > 0 ? "live" : "draft"
                                }`}
                              >
                                #{idx + 1}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: "var(--ink)" }}>
                                {entry.participantName}
                              </strong>
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                Page {entry.pageNumber} &middot; {entry.pageSubtitle}
                              </div>
                            </td>
                            <td>{entry.judgeCount}</td>
                            <td>
                              <strong style={{ color: "var(--accent)", fontSize: "0.96rem" }}>
                                {entry.avgTotal.toFixed(1)} / {entry.maxPossible}
                              </strong>
                            </td>
                            <td style={{ color: "var(--muted)", fontWeight: 600 }}>
                              {entry.sumTotal} / {entry.maxPossible * Math.max(1, entry.judgeCount)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`pixel-paper-btn compact ${isSelected ? "primary" : ""}`}
                                onClick={() => setSelectedParticipantKey(entry.key)}
                              >
                                <span>{isSelected ? "Viewing Breakdown" : "Criteria & Judges"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Participant Per-Criterion + Individual Judge Breakdown */}
              {activeParticipantDrilldown && (
                <div className="card stack" style={{ margin: 0, borderLeft: "6px solid var(--gold)" }}>
                  <div className="row-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>
                        Breakdown: {activeParticipantDrilldown.participantName}
                      </h3>
                      <p className="notice" style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>
                        Page {activeParticipantDrilldown.pageNumber} &middot; Average{" "}
                        <strong>
                          {activeParticipantDrilldown.avgTotal.toFixed(1)} /{" "}
                          {activeParticipantDrilldown.maxPossible}
                        </strong>{" "}
                        across {activeParticipantDrilldown.judgeCount} judge(s)
                      </p>
                    </div>
                  </div>

                  {/* Per-criterion average cards */}
                  <div className="grid-2" style={{ gap: "0.65rem" }}>
                    {activeParticipantDrilldown.scorableNodes.map((sn) => {
                      const maxM = getFieldMaxMarks(sn);
                      const avgM = activeParticipantDrilldown.perCriterionAvg[sn.id] ?? 0;
                      const pct = maxM > 0 ? Math.min(100, Math.round((avgM / maxM) * 100)) : 0;
                      return (
                        <div key={sn.id} className="admin-page-group-card">
                          <div className="row-between" style={{ gap: "0.5rem" }}>
                            <strong style={{ fontSize: "0.83rem" }}>{sn.label}</strong>
                            <span style={{ fontWeight: 800, color: "var(--accent)", fontSize: "0.86rem" }}>
                              {avgM.toFixed(1)} / {maxM}
                            </span>
                          </div>
                          <div className="progress-bar" style={{ marginTop: "0.35rem", height: "8px" }}>
                            <span style={{ width: `${pct}%`, background: "var(--accent)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Individual Judge Scores & Comments for this Participant */}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Judge Name</th>
                          {activeParticipantDrilldown.scorableNodes.map((sn, i) => (
                            <th key={sn.id} title={sn.label}>
                              C{i + 1} (/{getFieldMaxMarks(sn)})
                            </th>
                          ))}
                          <th>Total</th>
                          <th>Judge&apos;s Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeParticipantDrilldown.ballots.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeParticipantDrilldown.scorableNodes.length + 3}
                              className="notice"
                              style={{ textAlign: "center", padding: "1.25rem" }}
                            >
                              No submitted judge scores for this page yet.
                            </td>
                          </tr>
                        ) : (
                          activeParticipantDrilldown.ballots.map((b) => (
                            <tr key={b.submissionId}>
                              <td>
                                <strong>{b.judgeName}</strong>
                                <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                                  {b.accountEmail}
                                </div>
                              </td>
                              {activeParticipantDrilldown.scorableNodes.map((sn) => (
                                <td key={sn.id} style={{ fontWeight: 600 }}>
                                  {b.perCriterion[sn.id] !== null ? b.perCriterion[sn.id] : "—"}
                                </td>
                              ))}
                              <td>
                                <strong style={{ color: "var(--accent)" }}>
                                  {b.score} / {b.maxPossible}
                                </strong>
                              </td>
                              <td style={{ fontSize: "0.82rem", maxWidth: "280px" }}>
                                {b.comment || <span className="notice">—</span>}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              CATEGORY A2: SINGLE-PAGE GENERAL RANKING LEADERBOARD
              ================================================================= */}
          {activeCategory === "voting_evaluation" &&
            isSinglePageCandidateRanking &&
            singlePageCandidateRows.length > 0 && (
              <div className="card stack" style={{ background: "var(--surface-muted)", margin: 0 }}>
                <div className="row-between">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                    <PixelStarIcon size={16} />
                    <h3 style={{ margin: 0 }}>
                      General Competition Ranking{" "}
                      {selectedDate ? `(${selectedDate})` : "(All Dates)"}
                    </h3>
                  </div>
                  <span className="pixel-stamp-badge live">
                    {submittedOnly.length} BALLOT{submittedOnly.length === 1 ? "" : "S"}
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Participant</th>
                        <th>Judges</th>
                        <th>Average Score</th>
                        <th>Total Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singlePageCandidateRows.map((row, idx) => (
                        <tr key={row.id}>
                          <td>
                            <span
                              className={`pixel-stamp-badge ${
                                idx === 0 && row.judges > 0 ? "live" : "draft"
                              }`}
                            >
                              #{idx + 1}
                            </span>
                          </td>
                          <td>
                            <strong>{row.candidate}</strong>
                          </td>
                          <td>{row.judges}</td>
                          <td>
                            <strong style={{ color: "var(--accent)" }}>
                              {row.avgScore.toFixed(1)} / {row.maxPossible}
                            </strong>
                          </td>
                          <td style={{ color: "var(--muted)" }}>{row.sumScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {/* =================================================================
              CATEGORY A3: LEGACY SINGLE-PAGE DROPDOWN VOTING LEADERBOARD
              ================================================================= */}
          {activeCategory === "voting_evaluation" && legacyLeaderboardRows.length > 0 && (
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
                      {allScorableNodes.map((r) => (
                        <th key={r.id}>{r.label}</th>
                      ))}
                      <th>Avg Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyLeaderboardRows.map((row, rIdx) => (
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
                        {allScorableNodes.map((r) => (
                          <td key={r.id}>
                            {(row.perCriterion[r.id] ?? 0).toFixed(1)} / {getFieldMaxMarks(r)}
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

          {/* =================================================================
              CATEGORY B: STAFF COMPLAINTS CONFIDENTIAL CASE TABLE
              ================================================================= */}
          {activeCategory === "staff_complaints" ? (
            <div className="stack" style={{ gap: "0.85rem" }}>
              <div className="grid-3" style={{ gap: "0.75rem" }}>
                <div className="admin-page-group-card">
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 700 }}>
                    TOTAL REPORTS
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--ink)" }}>
                    {formSubmissions.length}
                  </div>
                </div>
                <div className="admin-page-group-card">
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 700 }}>
                    OPEN / IN REVIEW
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#a77922" }}>
                    {
                      formSubmissions.filter((s) => {
                        const st = ticketsBySubId[s.id]?.status;
                        return !st || (st !== "resolved" && st !== "closed");
                      }).length
                    }
                  </div>
                </div>
                <div className="admin-page-group-card">
                  <span style={{ fontSize: "0.74rem", color: "var(--muted)", fontWeight: 700 }}>
                    RESOLVED / CLOSED
                  </span>
                  <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--accent)" }}>
                    {
                      formSubmissions.filter((s) => {
                        const st = ticketsBySubId[s.id]?.status;
                        return st === "resolved" || st === "closed";
                      }).length
                    }
                  </div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Complainant</th>
                      <th>Contact</th>
                      <th>Category</th>
                      <th>Submitted</th>
                      <th>Ticket Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                          No confidential complaint reports found for {selectedDate || "any date"}.
                        </td>
                      </tr>
                    ) : (
                      formSubmissions.map((sub) => {
                        const ticket = ticketsBySubId[sub.id];
                        const meta = extractComplaintMeta(sub);
                        return (
                          <tr key={sub.id}>
                            <td>
                              <strong style={{ color: "var(--ink)" }}>{meta.complainantName}</strong>
                            </td>
                            <td style={{ fontSize: "0.8rem" }}>
                              <div>{meta.email}</div>
                              <div style={{ color: "var(--muted)" }}>{meta.phone}</div>
                            </td>
                            <td>
                              <span className="pixel-tag-pill">{meta.complaintCategory}</span>
                            </td>
                            <td style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                              {new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}
                            </td>
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
                                <span className="pixel-stamp-badge draft">NO TICKET</span>
                              )}
                            </td>
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
                                <span>
                                  {selectedSub?.id === sub.id ? "Hide Report" : "Read Report"}
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ===============================================================
               INDIVIDUAL SUBMISSIONS TABLE (COMPANY FORMS + VOTING BALLOTS)
               =============================================================== */
            <div className="stack" style={{ gap: "0.6rem" }}>
              {activeCategory === "voting_evaluation" && (
                <h3 style={{ margin: "0.25rem 0 0", fontSize: "0.95rem" }}>
                  Individual Judge Ballots ({formSubmissions.length})
                </h3>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {activeCategory === "voting_evaluation" ? "Judge" : "Submitted By"}
                      </th>
                      <th>Submitted Time</th>
                      <th>Status</th>
                      {isMultiPageCompetition && <th>Pages Scored</th>}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formSubmissions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isMultiPageCompetition ? 5 : 4}
                          className="notice"
                          style={{ textAlign: "center", padding: "2rem" }}
                        >
                          No submissions found for {selectedDate || "any date"}.
                        </td>
                      </tr>
                    ) : (
                      formSubmissions.map((sub) => {
                        const u = usersMap[sub.user_id];
                        const displayActor =
                          activeCategory === "voting_evaluation"
                            ? extractJudgeName(activeSchema, sub.answers_json, u)
                            : u?.display_name || u?.email || sub.user_id.slice(0, 8);
                        const scoredPagesCount = isMultiPageCompetition
                          ? scorablePages.filter((p) => {
                              const { scoredCount } = extractPageScore(
                                p.items.map((it) => it.node),
                                sub.answers_json,
                              );
                              return scoredCount > 0;
                            }).length
                          : 0;

                        return (
                          <tr key={sub.id}>
                            <td>
                              <strong style={{ color: "var(--ink)" }}>{displayActor}</strong>
                              {u?.email && u.email !== displayActor && (
                                <div style={{ fontSize: "0.74rem", color: "var(--muted)" }}>
                                  {u.email}
                                </div>
                              )}
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
                            {isMultiPageCompetition && (
                              <td>
                                <span className="pixel-tag-pill">
                                  {scoredPagesCount} / {scorablePages.length} pages
                                </span>
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
                                <span>
                                  {selectedSub?.id === sub.id
                                    ? "Hide Details"
                                    : activeCategory === "voting_evaluation"
                                      ? "View Ballot"
                                      : "View Answers"}
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              SUBMISSION DETAIL INSPECTOR (PAGE-GROUPED WHEN MULTI-PAGE)
              ================================================================= */}
          {selectedSub && (
            <div className="card stack" style={{ margin: 0, background: "var(--surface-muted)" }}>
              <div className="row-between">
                <div>
                  <strong>
                    Submission by{" "}
                    {usersMap[selectedSub.user_id]?.display_name ||
                      usersMap[selectedSub.user_id]?.email ||
                      selectedSub.user_id}
                  </strong>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {usersMap[selectedSub.user_id]?.email ? `${usersMap[selectedSub.user_id].email} · ` : ""}
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

              {selectedSubPages.length > 1 ? (
                <div className="stack" style={{ gap: "0.85rem" }}>
                  {selectedSubPages.map((pg) => {
                    const pgNodes = pg.items
                      .map((it) => it.node)
                      .filter(
                        (n) =>
                          n.type !== "heading" &&
                          n.type !== "instructions" &&
                          n.type !== "section" &&
                          n.type !== "image",
                      );
                    const pgScore = extractPageScore(pgNodes, selectedSub.answers_json);
                    return (
                      <div key={pg.pageNumber} className="admin-page-group-card stack" style={{ gap: "0.5rem" }}>
                        <div className="row-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                          <div>
                            <strong style={{ color: "var(--accent)", fontSize: "0.94rem" }}>
                              Page {pg.pageNumber}: {pg.title}
                            </strong>
                            {pg.subtitle && (
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                                {pg.subtitle}
                              </div>
                            )}
                          </div>
                          {pgScore.maxPossible > 0 && (
                            <span className="pixel-stamp-badge live">
                              TOTAL: {pgScore.score} / {pgScore.maxPossible}
                            </span>
                          )}
                        </div>
                        <div className="stack" style={{ gap: "0.4rem" }}>
                          {pgNodes.map((nodeDef) => {
                            const rawVal = selectedSub.answers_json?.[nodeDef.id];
                            const formatted = formatAnswerValue(rawVal);
                            return (
                              <div
                                key={nodeDef.id}
                                style={{
                                  background: "var(--surface-elevated)",
                                  border: "1.5px solid var(--border-strong)",
                                  borderRadius: "8px",
                                  padding: "0.55rem 0.8rem",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "1rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <strong style={{ fontSize: "0.83rem" }}>{nodeDef.label}</strong>
                                {nodeDef.type === "score_wheel" ||
                                nodeDef.type === "star_rating" ||
                                nodeDef.type === "linear_scale" ? (
                                  <span className="pixel-stamp-badge draft">
                                    {formatted} / {getFieldMaxMarks(nodeDef)}
                                  </span>
                                ) : nodeDef.type === "score_total" ? (
                                  <span className="pixel-stamp-badge live">
                                    {pgScore.score} / {pgScore.maxPossible}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.86rem", color: "var(--ink)" }}>
                                    {formatted}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="stack" style={{ gap: "0.55rem" }}>
                  {Object.entries(selectedSub.answers_json ?? {}).map(([fieldId, rawVal]) => {
                    const nodeDef = selectedSubSchema.find((n) => n.id === fieldId);
                    const displayLabel = nodeDef?.label || fieldId;
                    const formatted = formatAnswerValue(rawVal);

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
                        {nodeDef && isScorableField(nodeDef) ? (
                          <span className="pixel-stamp-badge draft">
                            <PixelStarIcon size={12} />
                            <span>
                              {formatted} / {getFieldMaxMarks(nodeDef)}
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.88rem", color: "var(--ink)" }}>
                            {formatted}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
