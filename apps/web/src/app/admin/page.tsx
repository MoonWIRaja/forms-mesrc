"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import {
  PixelCatalogIcon,
  PixelPlusIcon,
  PixelQuestionsIcon,
  PixelSettingsIcon,
  PixelStarIcon,
} from "@/components/PixelIcons";
import ServiceManager from "@/components/ServiceManager";
import {
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

export default function AdminPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmissionRow[]>([]);
  const [formsMap, setFormsMap] = useState<Record<string, FormRow>>({});
  const [versionsMap, setVersionsMap] = useState<Record<string, FormVersionMeta>>({});
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [selectedSub, setSelectedSub] = useState<AdminSubmissionRow | null>(null);
  const [selectedVotingFormId, setSelectedVotingFormId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"submissions" | "voting" | "services">("submissions");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const [{ data: prof }, { data: subRows }, { data: fRows }, { data: uRows }, { data: vRows }] =
          await Promise.all([
            supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
            supabase
              .from("submissions")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(200),
            supabase.from("forms").select("*"),
            supabase.from("profiles").select("id,email"),
            supabase.from("form_versions").select("form_id,version_number,schema_json,theme_json"),
          ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setSubmissions((subRows as AdminSubmissionRow[] | null) ?? []);
        const fList = (fRows as FormRow[] | null) ?? [];
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

        const firstVoting = fList.find((f) => {
          const latest = vMap[`${f.id}:${f.latest_version}`];
          return resolveFormCategory(f, latest?.theme_json) === "voting_evaluation";
        });
        if (firstVoting) setSelectedVotingFormId(firstVoting.id);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <ChunkLoader
        title="Admin Panel"
        subtitle="Loading submissions & operations..."
      />
    );
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

  const allForms = Object.values(formsMap);
  const votingForms = allForms.filter((f) => {
    const ver = versionsMap[`${f.id}:${f.latest_version}`];
    return resolveFormCategory(f, ver?.theme_json) === "voting_evaluation";
  });

  // Compute Leaderboard for selected Voting Form
  const activeVotingForm = formsMap[selectedVotingFormId];
  const activeVotingVer = activeVotingForm
    ? versionsMap[`${activeVotingForm.id}:${activeVotingForm.current_published_version ?? activeVotingForm.latest_version}`]
    : undefined;
  const activeVotingSchema = activeVotingVer?.schema_json ?? [];
  const ratingNodes = activeVotingSchema.filter(
    (n) => n.type === "star_rating" || n.type === "linear_scale",
  );
  const targetGroupNode = activeVotingSchema.find(
    (n) => n.type === "dropdown" || n.type === "single_choice",
  );
  const matchingVotes = submissions.filter(
    (s) => s.form_id === selectedVotingFormId && s.status === "submitted",
  );

  interface LeaderboardRow {
    candidate: string;
    ballots: number;
    avgTotal: number;
    maxPossible: number;
    perCriterion: Record<string, number>;
  }

  const leaderboardRows: LeaderboardRow[] = (() => {
    if (!selectedVotingFormId || ratingNodes.length === 0) return [];
    const maxPossible = ratingNodes.reduce((acc, n) => acc + (n.maxRating ?? (n.type === "linear_scale" ? 10 : 5)), 0);
    const groups: Record<string, AdminSubmissionRow[]> = {};
    for (const s of matchingVotes) {
      const candidateKey = targetGroupNode
        ? String(s.answers_json[targetGroupNode.id] || "Unspecified")
        : "Overall Form";
      groups[candidateKey] = [...(groups[candidateKey] ?? []), s];
    }
    return Object.entries(groups)
      .map(([candidate, ballots]) => {
        const perCriterion: Record<string, number> = {};
        let totalSum = 0;
        for (const rNode of ratingNodes) {
          let sum = 0;
          let cnt = 0;
          for (const b of ballots) {
            const val = Number(b.answers_json[rNode.id]);
            if (!Number.isNaN(val) && val > 0) {
              sum += val;
              cnt += 1;
            }
          }
          const avg = cnt > 0 ? sum / cnt : 0;
          perCriterion[rNode.id] = avg;
          totalSum += avg;
        }
        return {
          candidate,
          ballots: ballots.length,
          avgTotal: totalSum,
          maxPossible,
          perCriterion,
        };
      })
      .sort((a, b) => b.avgTotal - a.avgTotal);
  })();

  const selectedSubSchema = selectedSub
    ? versionsMap[`${selectedSub.form_id}:${selectedSub.form_version}`]?.schema_json ?? []
    : [];

  return (
    <div className="stack">
      <section className="card row-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <span className="pixel-tag-pill" style={{ marginBottom: "0.4rem" }}>
            ADMIN CONTROL DESK
          </span>
          <h1 style={{ margin: "0.2rem 0" }}>Submissions, Judging &amp; Services</h1>
          <p className="notice" style={{ margin: 0 }}>
            Inspect submitted forms, view Finalis MCEP voting leaderboards, and manage services.
          </p>
        </div>

        <div className="row-actions" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "submissions" ? "primary" : ""}`}
            onClick={() => setActiveTab("submissions")}
          >
            <PixelCatalogIcon size={13} />
            <span>Submissions ({submissions.length})</span>
          </button>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "voting" ? "primary" : ""}`}
            onClick={() => setActiveTab("voting")}
          >
            <PixelStarIcon size={13} />
            <span>Judging Leaderboard ({votingForms.length})</span>
          </button>
          <button
            type="button"
            className={`pixel-paper-btn compact ${activeTab === "services" ? "primary" : ""}`}
            onClick={() => setActiveTab("services")}
          >
            <PixelSettingsIcon size={13} />
            <span>Services</span>
          </button>
        </div>
      </section>

      {activeTab === "submissions" && (
        <section className="card stack">
          <div className="row-between">
            <h2 style={{ margin: 0 }}>Incoming Form Responses ({submissions.length})</h2>
            <Link href="/admin/forms/" className="pixel-paper-btn compact primary">
              <PixelPlusIcon size={13} />
              <span>Open Form Studio</span>
            </Link>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Respondent</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Date</th>
                  <th>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                      No submissions recorded yet.
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {formsMap[sub.form_id]?.title ?? sub.form_id.slice(0, 8)}
                      </td>
                      <td>{usersMap[sub.user_id] ?? sub.user_id.slice(0, 8)}</td>
                      <td>v{sub.form_version}</td>
                      <td>
                        <span
                          className={`pixel-stamp-badge ${sub.status === "submitted" ? "live" : "draft"}`}
                        >
                          {sub.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{sub.duration_seconds != null ? `${sub.duration_seconds}s` : "—"}</td>
                      <td style={{ fontSize: "0.84rem", color: "var(--muted)" }}>
                        {new Date(sub.submitted_at ?? sub.created_at).toLocaleString()}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pixel-paper-btn compact"
                          onClick={() => setSelectedSub(sub)}
                        >
                          <PixelQuestionsIcon size={12} />
                          <span>View Answers</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedSub && (
            <div className="card stack" style={{ margin: 0, background: "var(--surface-muted)" }}>
              <div className="row-between">
                <div>
                  <strong>
                    {formsMap[selectedSub.form_id]?.title ?? "Form"} (v{selectedSub.form_version})
                  </strong>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    Submitted by: {usersMap[selectedSub.user_id] ?? selectedSub.user_id}
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

      {activeTab === "voting" && (
        <section className="card stack">
          <div className="row-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>Voting &amp; Judging Scoreboard</h2>
              <p className="notice" style={{ margin: "0.2rem 0 0" }}>
                Real-time averaged judge scores for Voting &amp; Evaluation forms (such as Finalis MCEP).
              </p>
            </div>
            {votingForms.length > 0 && (
              <select
                value={selectedVotingFormId}
                onChange={(e) => setSelectedVotingFormId(e.target.value)}
                style={{ minWidth: "240px" }}
              >
                {votingForms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {votingForms.length === 0 ? (
            <p className="notice">
              No forms categorized under <strong>Voting &amp; Evaluation</strong> yet. Create one in Form Studio!
            </p>
          ) : ratingNodes.length === 0 ? (
            <p className="notice">
              Selected voting form does not contain Star Rating or Rubric Scale fields yet ({matchingVotes.length} submitted ballots).
            </p>
          ) : leaderboardRows.length === 0 ? (
            <p className="notice">
              No ballots submitted for <strong>{activeVotingForm?.title}</strong> yet.
            </p>
          ) : (
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
                    <th>Avg Total Score</th>
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
                        <strong style={{ color: "var(--accent)", fontSize: "1rem" }}>
                          {row.avgTotal.toFixed(1)} / {row.maxPossible}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "services" && (
        <section className="card">
          <ServiceManager />
        </section>
      )}
    </div>
  );
}
